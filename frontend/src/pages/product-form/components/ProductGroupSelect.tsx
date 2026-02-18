import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, Plus, X } from "lucide-react";

import { createProductGroup, fetchProductGroups } from "../../../services/productsApi";

export function ProductGroupSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const queryClient = useQueryClient();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const groupsQuery = useQuery({
    queryKey: ["product-groups"],
    queryFn: fetchProductGroups,
  });

  const createGroupMutation = useMutation({
    mutationFn: createProductGroup,
    onSuccess: async (newGroup) => {
      await queryClient.invalidateQueries({ queryKey: ["product-groups"] });
      onChange(String(newGroup.id));
      setIsCreating(false);
      setNewGroupName("");
      setIsOpen(false);
    },
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

  const selectedGroup = groupsQuery.data?.find((g) => String(g.id) === value);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!newGroupName.trim()) {
      return;
    }
    await createGroupMutation.mutateAsync({ name: newGroupName.trim() });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="input !pl-10 w-full text-left flex items-center justify-between transition-all focus:ring-2 ring-[var(--accent)]/20"
      >
        <span className={value ? "text-[var(--ink)]" : "text-[var(--muted)]"}>
          {selectedGroup ? selectedGroup.name : "Keine Gruppe"}
        </span>
        <ChevronDown size={16} className={`text-[var(--muted)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--panel)] border border-[var(--line)] rounded-lg shadow-lg z-50 overflow-hidden max-h-80 flex flex-col animate-in fade-in zoom-in-95 duration-100">
          {!isCreating ? (
            <>
              <div className="overflow-y-auto flex-1 py-1">
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-[var(--bg)] text-sm text-[var(--muted)] transition-colors"
                >
                  Keine Gruppe
                </button>
                {(groupsQuery.data ?? []).map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => {
                      onChange(String(group.id));
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-[var(--bg)] text-sm transition-colors ${
                      String(group.id) === value
                        ? "text-[var(--accent)] font-medium bg-[var(--bg)]"
                        : "text-[var(--ink)]"
                    }`}
                  >
                    {group.name}
                  </button>
                ))}
              </div>
              <div className="border-t border-[var(--line)] p-2 bg-[var(--panel-soft)]">
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsCreating(true);
                  }}
                  className="w-full btn btn-sm btn-ghost justify-start text-[var(--accent)] hover:bg-[var(--bg)]"
                >
                  <Plus size={14} />
                  Neue Gruppe erstellen
                </button>
              </div>
            </>
          ) : (
            <div className="p-3 space-y-3 bg-[var(--panel)]">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-[var(--muted)] uppercase">Neue Gruppe</h4>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              <input
                autoFocus
                className="input input-sm w-full"
                placeholder="Name der Gruppe"
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleCreate(event);
                  } else if (event.key === "Escape") {
                    setIsCreating(false);
                  }
                }}
              />
              <button
                type="button"
                onClick={(event) => void handleCreate(event)}
                disabled={createGroupMutation.isPending || !newGroupName.trim()}
                className="btn btn-sm btn-primary w-full justify-center"
              >
                {createGroupMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Erstellen"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
