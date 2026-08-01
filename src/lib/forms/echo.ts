/**
 * Lives outside any `'use server'` file on purpose: every export from a server
 * action module must be an async function, and this is a plain helper.
 */

const SECRET_FIELDS = ['password', 'confirmPassword', 'currentPassword'];

/**
 * Collects what the user typed so a validation error does not empty the form.
 * Passwords are never echoed — sending one back to the browser puts it in
 * history, logs and any proxy in between for no benefit.
 */
export function echoValues(
  formData: FormData,
  omit: string[] = SECRET_FIELDS,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (omit.includes(key)) continue;
    if (typeof value === 'string') values[key] = value;
  }
  return values;
}
