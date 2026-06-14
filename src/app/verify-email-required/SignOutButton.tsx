"use client";

export default function SignOutButton() {
  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/landing";
  };

  return (
    <button onClick={handleSignOut} className="text-xs text-muted">
      Sign out
    </button>
  );
}
