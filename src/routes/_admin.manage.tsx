import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Pencil, Save, X, Users, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_admin/manage")({
  head: () => ({ meta: [{ title: "Manage — ProductionTrack Admin" }] }),
  component: Manage,
});

interface Employee {
  id: string;
  name: string;
  nationality: string | null;
  active: boolean;
}
interface Step {
  id: string;
  step_name: string;
  description: string | null;
  active: boolean;
}

const NATIONALITIES = ["Thai", "Burmese", "Lao", "Khmer", "Other"];

function Manage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <Toaster richColors position="top-center" />
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Manage</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Add, edit, or remove employees and production steps.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <EmployeesPanel />
        <StepsPanel />
      </div>
    </main>
  );
}

function EmployeesPanel() {
  const [items, setItems] = useState<Employee[]>([]);
  const [name, setName] = useState("");
  const [nat, setNat] = useState("Thai");
  const [editing, setEditing] = useState<Employee | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("name");
    if (error) toast.error(error.message);
    setItems(data ?? []);
  };
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!name.trim()) return;
    const { error } = await supabase
      .from("employees")
      .insert({ name: name.trim(), nationality: nat });
    if (error) return toast.error(error.message);
    setName("");
    toast.success("Employee added");
    load();
  };

  const save = async () => {
    if (!editing) return;
    const { error } = await supabase
      .from("employees")
      .update({
        name: editing.name,
        nationality: editing.nationality,
        active: editing.active,
      })
      .eq("id", editing.id);
    if (error) return toast.error(error.message);
    setEditing(null);
    toast.success("Saved");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this employee? Past logs are preserved only if no logs reference it.")) return;
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <Users className="h-5 w-5 text-secondary" />
        Employees
      </h2>

      <div className="mb-4 grid grid-cols-[1fr_auto_auto] gap-2">
        <Input
          placeholder="Employee name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Select value={nat} onValueChange={setNat}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NATIONALITIES.map((n) => (
              <SelectItem key={n} value={n}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={add} className="gap-1">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      <ul className="divide-y divide-border">
        {items.map((e) => (
          <li key={e.id} className="py-2">
            {editing?.id === e.id ? (
              <div className="grid grid-cols-[1fr_120px_auto_auto] gap-2">
                <Input
                  value={editing.name}
                  onChange={(ev) => setEditing({ ...editing, name: ev.target.value })}
                />
                <Select
                  value={editing.nationality ?? "Other"}
                  onValueChange={(v) => setEditing({ ...editing, nationality: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NATIONALITIES.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="icon" onClick={save} className="bg-secondary hover:bg-secondary/90">
                  <Save className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={() => setEditing(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{e.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {e.nationality || "—"}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(e)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(e.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="py-4 text-center text-sm text-muted-foreground">
            No employees yet
          </li>
        )}
      </ul>
    </section>
  );
}

function StepsPanel() {
  const [items, setItems] = useState<Step[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [editing, setEditing] = useState<Step | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("steps")
      .select("*")
      .order("step_name");
    if (error) toast.error(error.message);
    setItems(data ?? []);
  };
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!name.trim()) return;
    const { error } = await supabase
      .from("steps")
      .insert({ step_name: name.trim(), description: desc.trim() || null });
    if (error) return toast.error(error.message);
    setName("");
    setDesc("");
    toast.success("Step added");
    load();
  };

  const save = async () => {
    if (!editing) return;
    const { error } = await supabase
      .from("steps")
      .update({
        step_name: editing.step_name,
        description: editing.description,
      })
      .eq("id", editing.id);
    if (error) return toast.error(error.message);
    setEditing(null);
    toast.success("Saved");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this step?")) return;
    const { error } = await supabase.from("steps").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <ListChecks className="h-5 w-5 text-secondary" />
        Production Steps
      </h2>

      <div className="mb-4 space-y-2">
        <Input
          placeholder="Step name (e.g. Cutting)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-2">
          <Input
            placeholder="Description (optional)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <Button onClick={add} className="gap-1">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      <ul className="divide-y divide-border">
        {items.map((s) => (
          <li key={s.id} className="py-2">
            {editing?.id === s.id ? (
              <div className="space-y-2">
                <Input
                  value={editing.step_name}
                  onChange={(ev) =>
                    setEditing({ ...editing, step_name: ev.target.value })
                  }
                />
                <div className="flex gap-2">
                  <Input
                    value={editing.description ?? ""}
                    onChange={(ev) =>
                      setEditing({ ...editing, description: ev.target.value })
                    }
                  />
                  <Button size="icon" onClick={save} className="bg-secondary hover:bg-secondary/90">
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => setEditing(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{s.step_name}</div>
                  {s.description && (
                    <div className="text-xs text-muted-foreground">
                      {s.description}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(s.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="py-4 text-center text-sm text-muted-foreground">
            No steps yet
          </li>
        )}
      </ul>
    </section>
  );
}
