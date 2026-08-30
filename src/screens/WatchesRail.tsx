import { useState } from "react";
import { shortAddress } from "../data/fixture";
import {
  sameAddress,
  type Watch,
} from "../lib/watchAddress";

type Props = {
  watches: Watch[];
  loaded: string;
  error: string | null;
  onOpen: (address: string) => void;
  onAdd: (address: string, name: string) => string | null;
  onRename: (address: string, name: string) => void;
  onRemove: (address: string) => void;
};

export function WatchesRail({
  watches,
  loaded,
  error,
  onOpen,
  onAdd,
  onRename,
  onRemove,
}: Props) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  function submitAdd() {
    const fail = onAdd(address, name);
    if (fail) {
      setFormError(fail);
      return;
    }
    setFormError(null);
    setName("");
    setAddress("");
  }

  function commitRename(addr: string) {
    onRename(addr, draft);
    setEditing(null);
  }

  return (
    <aside className="watches-rail">
      <div className="k">Watches</div>
      <div className="watch-list">
        {watches.length === 0 ? (
          <div className="muted watch-empty">No saved books yet.</div>
        ) : (
          watches.map((w) => {
            const on = loaded && sameAddress(w.address, loaded);
            return (
              <div
                key={w.address}
                className={`watch-row ${on ? "on" : ""}`}
              >
                {editing && sameAddress(editing, w.address) ? (
                  <input
                    className="watch-rename"
                    value={draft}
                    autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => commitRename(w.address)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(w.address);
                      if (e.key === "Escape") setEditing(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="watch-open"
                    onClick={() => onOpen(w.address)}
                  >
                    <span className="watch-name">{w.name}</span>
                    <span className="muted">{shortAddress(w.address)}</span>
                  </button>
                )}
                <div className="watch-actions">
                  <button
                    type="button"
                    className="watch-icon"
                    title="Rename"
                    onClick={() => {
                      setEditing(w.address);
                      setDraft(w.name);
                    }}
                  >
                    edit
                  </button>
                  <button
                    type="button"
                    className="watch-icon"
                    title="Remove"
                    onClick={() => onRemove(w.address)}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="watch-add">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          spellCheck={false}
        />
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitAdd()}
          placeholder="bc1p… or 1…"
          spellCheck={false}
        />
        <button type="button" className="btn primary" onClick={submitAdd}>
          Add
        </button>
        {formError || error ? (
          <div className="muted">{formError ?? error}</div>
        ) : null}
      </div>
    </aside>
  );
}
