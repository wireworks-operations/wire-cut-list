## 2025-05-14 - Accessible Micro-Feedback
**Learning:** Using browser alerts is disruptive to user flow and inaccessible for keyboard/screen reader users who lose context. Replacing them with ARIA-live toast notifications provides non-blocking feedback while maintaining accessibility.
**Action:** Always prefer ARIA-live regions for status updates and ensure toast containers have `aria-live="polite"` and `role="status"`.
