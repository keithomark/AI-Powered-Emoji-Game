extends Control

@onready var emoji_display = $EmojiDisplay
@onready var option_buttons = [$Options/Option1, $Options/Option2, $Options/Option3, $Options/Option4]
@onready var score_label = $TopBar/ScoreLabel
@onready var timer_label = $TopBar/TimerLabel
@onready var hint_button = $HintButton
@onready var hint_popup = $HintPopup
@onready var hint_text = $HintPopup/HintText
@onready var http_request = HTTPRequest.new()

@onready var click_sound = AudioStreamPlayer.new()
@onready var correct_sound = AudioStreamPlayer.new()
@onready var wrong_sound = AudioStreamPlayer.new()

var backend_url = "http://localhost:3000"
var current_phrase = "" # This will store the correct answer string
var score = 0
var timer_sec = 15.0 # Use float for delta accumulation
var timer_active = false

func _ready():
    add_child(http_request)
    hint_button.connect("pressed", Callable(self, "_on_hint_button_pressed"))
    for btn in option_buttons:
        btn.connect("pressed", Callable(self, "_on_option_pressed").bind(btn))
    # Connect the main request_completed signal here for combo responses initially
    http_request.connect("request_completed", Callable(self, "_on_combo_request_completed"))

    click_sound.stream = load("res://assets/click.wav")
    correct_sound.stream = load("res://assets/correct.wav")
    wrong_sound.stream = load("res://assets/wrong.wav")
    add_child(click_sound)
    add_child(correct_sound)
    add_child(wrong_sound)

    start_new_round()

func start_new_round():
    reset_timer()
    for btn in option_buttons:
        btn.disabled = true # Disable buttons until options are loaded
        btn.release_focus() # Remove focus from any previously pressed button
        btn.remove_theme_color_override("font_color") # Ensure colors are reset
    emoji_display.text = "Loading..."
    hint_button.disabled = true # Disable hint button until phrase is loaded
    # Make sure this request is specifically for combos
    http_request.request(backend_url + "/combo") # Removed "?category=general" as backend doesn't use it

func reset_timer():
    timer_sec = 15.0
    timer_label.text = "Time: 15"
    timer_active = false

func _process(delta):
    if timer_active:
        timer_sec -= delta
        timer_label.text = "Time: " + str(int(max(0,timer_sec))) # Ensure time doesn't go negative
        if timer_sec <= 0:
            timer_active = false
            wrong_sound.play() # Play wrong sound when timer expires
            show_correct_answer_feedback(false) # Pass false as it's a timeout
            await get_tree().create_timer(1.5).timeout
            start_new_round()

func _on_hint_button_pressed():
    click_sound.play() # Play click sound when hint button is pressed
    if current_phrase == "" or not timer_active: # Also check if timer is active
        return

    # Disconnect combo handler if connected, to prevent it from processing hint response
    if http_request.is_connected("request_completed", Callable(self, "_on_combo_request_completed")):
        http_request.disconnect("request_completed", Callable(self, "_on_combo_request_completed"))

    # Connect hint handler with CONNECT_ONE_SHOT so it automatically disconnects after firing
    http_request.connect("request_completed", Callable(self, "_on_hint_request_completed"), CONNECT_ONE_SHOT)

    var body = {"phrase": current_phrase} # Send the correct answer as the phrase for hint
    var json_body = JSON.stringify(body)
    var headers = ["Content-Type: application/json"]
    http_request.request(backend_url + "/hint", headers, HTTPClient.METHOD_POST, json_body)
    hint_button.disabled = true # Disable hint button after use for this round


# Specific handler for combo request responses
func _on_combo_request_completed(result, response_code, headers, body):
    if response_code != 200:
        print("HTTP error for combo request: ", response_code)
        emoji_display.text = "Error loading combo!"
        # Optionally, try to load another combo or show an error to the user
        await get_tree().create_timer(2.0).timeout # Brief pause before retrying
        start_new_round()
        return

    var response_string = body.get_string_from_utf8()
    var response = JSON.parse_string(response_string)

    if response and response.has("emojis") and response.has("options") and response.has("correct_answer"):
        current_phrase = response["correct_answer"] # Store the correct answer string
        # Assuming response["emojis"] is a string like "🧑‍🍳💋" from the backend.
        # If it's an array of single emojis, " ".join() would be good.
        # If it's already a two-emoji string, direct assignment is fine.
        emoji_display.text = response["emojis"] 
        
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
            await get_tree().create_timer(2.0).timeout
            start_new_round()
            return

        timer_active = true # Start timer only after UI is updated
        hint_button.disabled = false # Enable hint button
        hint_popup.hide() # Hide hint popup if it was open
    else:
        print("Invalid combo data structure from backend: ", response_string)
        emoji_display.text = "Data Error!"
        await get_tree().create_timer(2.0).timeout
        start_new_round()

# Specific handler for hint request responses
func _on_hint_request_completed(result, response_code, headers, body):
    if response_code == 200:
        var response_string = body.get_string_from_utf8()
        var response = JSON.parse_string(response_string)
        if response and response.has("hint"):
            hint_text.text = response["hint"]
            hint_popup.popup_centered()
        else:
            print("Invalid hint data structure from backend: ", response_string)
            hint_text.text = "Hint error." # Show some error in popup
            hint_popup.popup_centered()
    else:
        print("Hint request failed: ", response_code)
        hint_text.text = "Could not fetch hint."
        hint_popup.popup_centered()
    
    # Reconnect the combo handler for subsequent combo requests
    # This is crucial because the hint handler used CONNECT_ONE_SHOT or was manually disconnected.
    if not http_request.is_connected("request_completed", Callable(self, "_on_combo_request_completed")):
        http_request.connect("request_completed", Callable(self, "_on_combo_request_completed"))
    hint_button.disabled = false # Re-enable in case of error, or manage as per game rules


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


func _on_option_pressed(button_pressed):
    if not timer_active: # Ignore presses if timer is not active (e.g., during feedback or loading)
        return

    click_sound.play()
    timer_active = false # Stop timer once an option is pressed

    if button_pressed.text == current_phrase:
        score += 1
        score_label.text = "Score: " + str(score)
        correct_sound.play()
        show_correct_answer_feedback(true)
    else:
        wrong_sound.play()
        show_correct_answer_feedback(false)

    # Disable hint button after an answer is chosen
    hint_button.disabled = true

    await get_tree().create_timer(1.5).timeout # Wait before starting new round
    start_new_round()

```
