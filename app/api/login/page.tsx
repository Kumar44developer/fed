"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const router = useRouter();


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setMsg("");
    const supabase = supabaseBrowser();
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("Account created! Check your email to confirm, then log in.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
        router.refresh();
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand" style={{ justifyContent: "center", marginBottom: 18 }}>
          <div className="brand-icon">▶</div>
          <div>
            <div className="brand-name">InstaFeed</div>
            <div className="brand-tag">YOUR FEED, YOUR RULES</div>
          </div>
        </div>
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <form onSubmit={submit}>
          <input
            className="text-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            className="text-input"
            type="password"
