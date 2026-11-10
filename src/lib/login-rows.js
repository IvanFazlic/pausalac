import { formatDateTime } from "@/lib/dates";

// Shapes a users row for the LoginManager component: plain values only, with
// dates already formatted on the server.
export function toLoginRow(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    must_change_password: user.must_change_password,
    disabled_at: user.disabled_at ? "disabled" : null,
    last_login_label: user.last_login_at ? formatDateTime(user.last_login_at) : null,
  };
}
