"use client";

import { useState, useEffect, useCallback } from "react";

interface Note {
  id: string;
  author: string;
  content: string;
  created_at: string;
}

export function OrderNotes({ orderId }: { orderId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/notes`);
      const data = await res.json();
      setNotes(data.notes || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setNotes((prev) => [data.note, ...prev]);
        setContent("");
      }
    } catch {
      // silently fail
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-card border border-brand-rose/[0.06] bg-white p-6 shadow-card">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-brand-taupe">
        Internal Notes
      </h3>

      {/* Add note form */}
      <form onSubmit={handleSubmit} className="mb-5">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add an internal note..."
          rows={3}
          maxLength={2000}
          className="w-full resize-none rounded-input border border-brand-rose/[0.1] bg-brand-cream/30 px-4 py-3 text-sm text-brand-espresso placeholder:text-brand-taupe/50 focus:border-brand-rose focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-rose/20"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-brand-taupe/50">
            {content.length}/2000
          </span>
          <button
            type="submit"
            disabled={!content.trim() || submitting}
            className="rounded-button bg-brand-rose px-4 py-1.5 text-xs font-medium text-white transition-all hover:shadow-button disabled:opacity-40"
          >
            {submitting ? "Saving..." : "Add Note"}
          </button>
        </div>
      </form>

      {/* Notes list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-input bg-brand-cream/50" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <p className="text-center text-sm text-brand-taupe/60">
          No notes yet.
        </p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded-input border border-brand-rose/[0.04] bg-brand-cream/20 px-4 py-3"
            >
              <p className="text-sm text-brand-brown">{note.content}</p>
              <p className="mt-2 text-[11px] text-brand-taupe/60">
                {note.author} &middot;{" "}
                {new Date(note.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
