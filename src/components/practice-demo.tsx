"use client";
import { useState } from "react";
import { z } from "zod";
export default function PracticeDemo() {
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  return (
    <div className="practice-card">
      <span className="eyebrow">UNGRADED EXERCISE · ARITHMETIC</span>
      <h2>Make a study routine you can sustain.</h2>
      <p>
        You study for 25 minutes a day over 4 days, then add a 10-minute recap.
        How many minutes do you study altogether?
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const result = z.coerce.number().int().nonnegative().safeParse(value);
          if (!value.trim() || !result.success) {
            setMessage("Enter a whole number of minutes, zero or greater.");
            return;
          }
          setMessage(
            result.data === 110
              ? "You found it: 4 × 25 + 10 = 110 minutes. Multiplication gives the four study sessions; then add the recap."
              : "Try working out 4 × 25 first, then add the 10-minute recap. You can try again; this exercise is not scored.",
          );
        }}
      >
        <label htmlFor="minutes">Your answer in minutes</label>
        <input
          id="minutes"
          type="number"
          min="0"
          step="1"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setMessage("");
          }}
          required
          aria-describedby="practice-feedback"
        />
        <button className="button" type="submit">
          Check my thinking →
        </button>
      </form>
      <p id="practice-feedback" role="status" className="feedback">
        {message}
      </p>
      <p className="fine-print">
        Draft teaching demo. No account, timer, stored result or official score.
        For graded practice, sign in and choose an available reviewed session
        above.
      </p>
    </div>
  );
}
