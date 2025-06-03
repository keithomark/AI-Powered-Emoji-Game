extends Control

@onready var emoji_display = $VBoxContainer/EmojiDisplay
@onready var option_buttons = [
    $VBoxContainer/Options/Option1,
    $VBoxContainer/Options/Option2,
    $VBoxContainer/Options/Option3,
    $VBoxContainer/Options/Option4
]
@onready var score_label = $VBoxContainer/TopBar/ScoreLabel
@onready var timer_label = $VBoxContainer/TopBar/TimerLabel
@onready var hint_button = $VBoxContainer/HintButton
@onready var hint_popup = $HintPopup # This is a direct child of Main
@onready var hint_text = $HintPopup/HintText # This is correct relative to HintPopup
@onready var animation_player = $VBoxContainer/AnimationPlayer
@onready var visual_timer = $VBoxContainer/TopBar/VisualTimer
@onready var how_to_play_button = $VBoxContainer/TopBar/HowToPlayButton
@onready var http_request = HTTPRequest.new()

const HowToPlayScene = preload("res://scenes/HowToPlay.tscn")
var how_to_play_instance = null
var game_was_active_before_tutorial = false # To handle timer resume correctly

var backend_url = "http://localhost:3000"
var current_phrase = "" # This will store the correct answer string
var score = 0
var timer_sec = 15.0 # Use float for delta accumulation
var timer_active = false
var _next_emoji_text = "" # For change_emoji_content animation
var _original_hint_button_text = "" # For hint button loading text

func _ready():
    add_child(http_request)
    hint_button.connect("pressed", Callable(self, "_on_hint_button_pressed"))
    for btn in option_buttons:
        btn.connect("pressed", Callable(self, "_on_option_pressed").bind(btn))
    # Connect the main request_completed signal here for combo responses initially
    http_request.connect("request_completed", Callable(self, "_on_combo_request_completed"))

    how_to_play_button.connect("pressed", Callable(self, "_on_how_to_play_pressed"))

    # Instantiate and prepare HowToPlay screen
    if HowToPlayScene:
        how_to_play_instance = HowToPlayScene.instantiate()
        add_child(how_to_play_instance)
        how_to_play_instance.visible = false
        var back_button = how_to_play_instance.get_node_or_null("Panel/VBoxContainer/BackButton")
        if back_button:
            back_button.connect("pressed", Callable(self, "_on_how_to_play_closed"))
        else:
            print("Error: Back button not found in HowToPlay scene instance at path: Panel/VBoxContainer/BackButton")

    visual_timer.max_value = timer_sec # Initialize max_value, could also be done in editor
    visual_timer.value = timer_sec      # Initialize current value
    start_new_round()

func _on_how_to_play_pressed():
    if how_to_play_instance:
        how_to_play_instance.visible = true
        game_was_active_before_tutorial = timer_active
        timer_active = false # Pause timer
        # Disable game buttons
        for btn in option_buttons:
            btn.disabled = true
        hint_button.disabled = true

func _on_how_to_play_closed():
    if how_to_play_instance:
        how_to_play_instance.visible = false
        if game_was_active_before_tutorial: # Only resume if it was active
             # Check if a round is actually in progress (not loading/error)
            if emoji_display.text != "Loading..." and emoji_display.text != "Error loading combo!" and emoji_display.text != "Options Error!" and emoji_display.text != "Data Error!":
                timer_active = true
        game_was_active_before_tutorial = false # Reset flag

        # Re-enable game buttons only if a round is active and not showing an error
        var round_is_interactive = emoji_display.text != "Loading..." and \
                                   emoji_display.text != "Error loading combo!" and \
                                   emoji_display.text != "Options Error!" and \
                                   emoji_display.text != "Data Error!" and \
                                   timer_sec > 0

        if round_is_interactive:
            for btn in option_buttons:
                # Check if the option text itself indicates it's a real option vs placeholder/error
                if btn.text != "" and not btn.text.begins_with("Option "): # Basic check
                    btn.disabled = false
            hint_button.disabled = false
        else: # If round is not interactive (e.g. loading, error, or between rounds)
            for btn in option_buttons:
                btn.disabled = true
            hint_button.disabled = true


func start_new_round():
    reset_timer()
    for btn in option_buttons:
        btn.disabled = true # Disable buttons until options are loaded
        btn.release_focus() # Remove focus from any previously pressed button
        btn.remove_theme_color_override("font_color") # Ensure colors are reset

    emoji_display.modulate.a = 1 # Ensure it's visible for loading animation
    animation_player.play("loading_indicator_anim")
    hint_button.disabled = true # Disable hint button until phrase is loaded
    # Make sure this request is specifically for combos
    http_request.request(backend_url + "/combo") # Removed "?category=general" as backend doesn't use it

func _on_emoji_fade_out_complete():
    emoji_display.text = _next_emoji_text
    animation_player.play("emoji_fade_in")

func reset_timer():
    timer_sec = 15.0
    timer_label.text = "Time: 15"
    visual_timer.value = timer_sec # Reset visual timer
    timer_active = false

func _process(delta):
    if timer_active:
        timer_sec -= delta
        timer_label.text = "Time: " + str(int(max(0,timer_sec))) # Ensure time doesn't go negative
        visual_timer.value = timer_sec # Update visual timer
        if timer_sec <= 0:
            timer_active = false
            visual_timer.value = 0 # Ensure it's visually empty
            show_correct_answer_feedback(false) # Pass false as it's a timeout
            await get_tree().create_timer(1.5).timeout
            start_new_round()

func _on_hint_button_pressed():
    if current_phrase == "" or not timer_active: # Also check if timer is active
        return

    _original_hint_button_text = hint_button.text
    hint_button.text = "Fetching..."
    hint_button.disabled = true # Ensure it's disabled

    # Disconnect combo handler if connected, to prevent it from processing hint response
    if http_request.is_connected("request_completed", Callable(self, "_on_combo_request_completed")):
        http_request.disconnect("request_completed", Callable(self, "_on_combo_request_completed"))

    # Connect hint handler with CONNECT_ONE_SHOT so it automatically disconnects after firing
    http_request.connect("request_completed", Callable(self, "_on_hint_request_completed"), CONNECT_ONE_SHOT)

    var body = {"phrase": current_phrase} # Send the correct answer as the phrase for hint
    var json_body = JSON.stringify(body)
    var headers = ["Content-Type: application/json"]
    http_request.request(backend_url + "/hint", headers, HTTPClient.METHOD_POST, json_body)
    # hint_button.disabled = true # Already disabled above


# Specific handler for combo request responses
func _on_combo_request_completed(result, response_code, headers, body):
    animation_player.stop() # Stop loading_indicator_anim

    if response_code != 200:
        print("HTTP error for combo request: ", response_code)
        emoji_display.text = "Error loading combo!"
        emoji_display.modulate.a = 1 # Make it visible directly
        # Optionally, try to load another combo or show an error to the user
        await get_tree().create_timer(2.0).timeout # Brief pause before retrying
        start_new_round() # This will trigger loading animation again
        return

    var response_string = body.get_string_from_utf8()
    var response = JSON.parse_string(response_string)

    if response and response.has("emojis") and response.has("options") and response.has("correct_answer"):
        current_phrase = response["correct_answer"] # Store the correct answer string
        _next_emoji_text = response["emojis"]
        animation_player.play("change_emoji_content") # This will fade out "Loading...", then call method to set new text & fade in
        
        if response["options"].size() == option_buttons.size():
            # Shuffle options client-side for better randomness if desired, or ensure backend shuffles well
            # var shuffled_options = response["options"].duplicate() # Duplicate to avoid modifying original if needed elsewhere
            # shuffled_options.shuffle()
            for i in range(option_buttons.size()):
                option_buttons[i].text = response["options"][i] # Using backend-shuffled options
                option_buttons[i].disabled = false
        else:
            print("Error: Number of options from backend (", response["options"].size(), ") does not match number of buttons (", option_buttons.size(), ").")
            emoji_display.text = "Options Error!"
            emoji_display.modulate.a = 1 # Make error visible
            await get_tree().create_timer(2.0).timeout
            start_new_round() # This will trigger loading animation again
            return

        timer_active = true # Start timer only after UI is updated
        hint_button.disabled = false # Enable hint button
        hint_popup.hide() # Hide hint popup if it was open
    else:
        print("Invalid combo data structure from backend: ", response_string)
        emoji_display.text = "Data Error!"
        emoji_display.modulate.a = 1 # Make error visible
        await get_tree().create_timer(2.0).timeout
        start_new_round() # This will trigger loading animation again

# Specific handler for hint request responses
func _on_hint_request_completed(result, response_code, headers, body):
    hint_button.text = _original_hint_button_text # Restore original text

    if response_code == 200:
        var response_string = body.get_string_from_utf8()
        var response = JSON.parse_string(response_string)
        if response and response.has("hint"):
            hint_text.text = response["hint"]
        else:
            print("Invalid hint data structure from backend: ", response_string)
            hint_text.text = "Hint error." # Show some error in popup
    else:
        print("Hint request failed: ", response_code)
        hint_text.text = "Could not fetch hint."

    hint_popup.modulate.a = 0.0
    hint_popup.scale = Vector2(0.8, 0.8)
    hint_popup.popup_centered() # Position it first
    animation_player.play("hint_popup_appear") # Then play animation
    
    # Reconnect the combo handler for subsequent combo requests
    # This is crucial because the hint handler used CONNECT_ONE_SHOT or was manually disconnected.
    if not http_request.is_connected("request_completed", Callable(self, "_on_combo_request_completed")):
        http_request.connect("request_completed", Callable(self, "_on_combo_request_completed"))

    # Re-enable hint button only if timer is still active (i.e., player didn't lose/win while hint was fetching)
    if timer_active:
        hint_button.disabled = false


func show_correct_answer_feedback(is_correct_choice):
    timer_active = false # Stop the timer
    for btn in option_buttons:
        btn.disabled = true # Disable all buttons after an answer
        if btn.text == current_phrase: # This is the correct button
            # Always highlight the correct answer in green
            btn.add_theme_color_override("font_color", Color.GREEN)
        elif btn.is_pressed() and not is_correct_choice: # This was pressed by user and is wrong
             btn.add_theme_color_override("font_color", Color.RED)
        else: # Other buttons that weren't pressed and aren't the correct answer
            btn.add_theme_color_override("font_color", Color(0.7, 0.7, 0.7, 0.5)) # Dim others (slightly transparent gray)
    
    # No need to await here, color override is immediate.
    # The await for next round is in _on_option_pressed

# Note: Resetting colors is handled by start_new_round calling remove_theme_color_override.
# The await get_tree().create_timer(1.5).timeout in _on_option_pressed handles the delay before next round.

```
