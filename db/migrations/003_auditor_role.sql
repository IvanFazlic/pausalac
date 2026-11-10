-- A third kind of login: read-only access to every invoice, for an accountant
-- or the tax office. It belongs to no client (client_id stays NULL, which the
-- existing users_role_client constraint already requires for non-client roles).

ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('owner', 'client', 'auditor'));
