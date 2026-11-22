import { login } from "../actions";

export const metadata = { title: "Acceso · Prospect Intelligence" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="login">
      <form action={login} className="login-box">
        <div className="brand">Prospect Intelligence</div>
        <label htmlFor="pw" className="lbl">Contraseña</label>
        <input id="pw" name="password" type="password" autoFocus required className="input" />
        {error && <p className="err">Contraseña incorrecta.</p>}
        <button className="btn primary" type="submit">Entrar</button>
      </form>
    </main>
  );
}
