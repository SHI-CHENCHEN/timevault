/*
  TIMEVAULT physical controller — Phase 1

  Sends newline-delimited JSON at 115200 baud.
  Receives server feedback without requiring any external Arduino library.
  All timing is non-blocking so future LEDs, a servo, a motor, or vibration can
  be updated continuously.
*/

// ----- Pin definitions: change these to match the final enclosure wiring -----
const uint8_t ENCODER_PIN_A = 2;
const uint8_t ENCODER_PIN_B = 3;
const uint8_t SELL_BUTTON_PIN = 4;
const uint8_t BUY_BUTTON_PIN = 5;
const uint8_t CONFIRM_BUTTON_PIN = 6;
const uint8_t CANCEL_BUTTON_PIN = 7;  // Optional; leave unconnected with INPUT_PULLUP.
const uint8_t STATUS_LED_PIN = LED_BUILTIN;

const unsigned long DEBOUNCE_MS = 35;
const unsigned long HEARTBEAT_MS = 1000;

struct DebouncedButton {
  uint8_t pin;
  bool stableState;
  bool lastReading;
  unsigned long changedAt;
};

DebouncedButton sellButton = {SELL_BUTTON_PIN, HIGH, HIGH, 0};
DebouncedButton buyButton = {BUY_BUTTON_PIN, HIGH, HIGH, 0};
DebouncedButton confirmButton = {CONFIRM_BUTTON_PIN, HIGH, HIGH, 0};
DebouncedButton cancelButton = {CANCEL_BUTTON_PIN, HIGH, HIGH, 0};

uint8_t encoderHistory = 0;
int8_t encoderAccumulator = 0;
String incomingLine;
int selectedMinutes = 15;
unsigned long feedbackPulseEndsAt = 0;
unsigned long lastHeartbeatAt = 0;

void sendEvent(const __FlashStringHelper* json) {
  Serial.println(json);
}

void sendMode(const char* value) {
  Serial.print(F("{\"type\":\"mode\",\"value\":\""));
  Serial.print(value);
  Serial.println(F("\"}"));
}

void sendEncoder(const char* direction) {
  Serial.print(F("{\"type\":\"encoder\",\"direction\":\""));
  Serial.print(direction);
  Serial.println(F("\"}"));
}

bool buttonPressed(DebouncedButton& button, unsigned long now) {
  const bool reading = digitalRead(button.pin);
  if (reading != button.lastReading) {
    button.lastReading = reading;
    button.changedAt = now;
  }
  if (now - button.changedAt >= DEBOUNCE_MS && reading != button.stableState) {
    button.stableState = reading;
    return button.stableState == LOW;
  }
  return false;
}

void readButtons(unsigned long now) {
  if (buttonPressed(sellButton, now)) sendMode("SELL");
  if (buttonPressed(buyButton, now)) sendMode("BUY");
  if (buttonPressed(confirmButton, now)) sendEvent(F("{\"type\":\"confirm\"}"));
  if (buttonPressed(cancelButton, now)) sendEvent(F("{\"type\":\"cancel\"}"));
}

void readEncoder() {
  // Gray-code transition table. A full detent produces an accumulator of +/-4.
  static const int8_t transitionTable[16] = {
     0, -1,  1,  0,
     1,  0,  0, -1,
    -1,  0,  0,  1,
     0,  1, -1,  0
  };
  const uint8_t current = (digitalRead(ENCODER_PIN_A) << 1) | digitalRead(ENCODER_PIN_B);
  encoderHistory = ((encoderHistory << 2) | current) & 0x0F;
  encoderAccumulator += transitionTable[encoderHistory];
  if (encoderAccumulator >= 4) {
    encoderAccumulator = 0;
    sendEncoder("CW");
  } else if (encoderAccumulator <= -4) {
    encoderAccumulator = 0;
    sendEncoder("CCW");
  }
}

int extractInteger(const String& line, const String& key, int fallback) {
  const int keyIndex = line.indexOf(key);
  if (keyIndex < 0) return fallback;
  int cursor = keyIndex + key.length();
  while (cursor < (int)line.length() && (line[cursor] == ' ' || line[cursor] == ':')) cursor++;
  int value = 0;
  bool found = false;
  while (cursor < (int)line.length() && isDigit(line[cursor])) {
    value = value * 10 + (line[cursor] - '0');
    cursor++;
    found = true;
  }
  return found ? value : fallback;
}

void handleFeedback(const String& line, unsigned long now) {
  if (line.indexOf(F("\"type\":\"feedback\"")) < 0) return;
  selectedMinutes = extractInteger(line, F("\"minutes\""), selectedMinutes);
  feedbackPulseEndsAt = now + 180;
  digitalWrite(STATUS_LED_PIN, HIGH);

  // Future output integration belongs here. The message state can be:
  // SELECT, SELL_PROCESSING, SELL_COMPLETE, BUY_PROCESSING,
  // BUY_COUNTDOWN, BUY_COMPLETE, or CANCELLED.
  // updateWs2812(line); updateServo(line); updateMotor(line);
}

void readSerialFeedback(unsigned long now) {
  while (Serial.available() > 0) {
    const char character = (char)Serial.read();
    if (character == '\n') {
      incomingLine.trim();
      if (incomingLine.length() > 0) handleFeedback(incomingLine, now);
      incomingLine = "";
    } else if (character != '\r' && incomingLine.length() < 192) {
      incomingLine += character;
    }
  }
}

void updateOutputs(unsigned long now) {
  if (feedbackPulseEndsAt > 0 && now >= feedbackPulseEndsAt) {
    feedbackPulseEndsAt = 0;
    digitalWrite(STATUS_LED_PIN, LOW);
  }
}

void setup() {
  pinMode(ENCODER_PIN_A, INPUT_PULLUP);
  pinMode(ENCODER_PIN_B, INPUT_PULLUP);
  pinMode(SELL_BUTTON_PIN, INPUT_PULLUP);
  pinMode(BUY_BUTTON_PIN, INPUT_PULLUP);
  pinMode(CONFIRM_BUTTON_PIN, INPUT_PULLUP);
  pinMode(CANCEL_BUTTON_PIN, INPUT_PULLUP);
  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);

  encoderHistory = (digitalRead(ENCODER_PIN_A) << 1) | digitalRead(ENCODER_PIN_B);
  Serial.begin(115200);
  incomingLine.reserve(192);
  sendEvent(F("{\"type\":\"connected\",\"device\":\"TIMEVAULT\"}"));
}

void loop() {
  const unsigned long now = millis();
  readEncoder();
  readButtons(now);
  readSerialFeedback(now);
  updateOutputs(now);

  // Reserved for future physical-output heartbeat work. No blocking delay.
  if (now - lastHeartbeatAt >= HEARTBEAT_MS) lastHeartbeatAt = now;
}
