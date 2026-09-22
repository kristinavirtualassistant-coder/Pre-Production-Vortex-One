import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Circle,
  ListTodo,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Task, TaskPriority } from '../types';

interface TasksViewProps {
  tasks?: Task[];
  onAddTask?: (task: { objective: string; priority: TaskPriority; due_date: string }) => Promise<void>;
}

interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

type Filter = 'all' | 'active' | 'completed';

const STORAGE_KEY = 'vortex-one-todos';

const readTodos = (): TodoItem[] => {
  if (typeof window === 'undefined') return [];

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (todo): todo is TodoItem =>
        typeof todo === 'object' &&
        todo !== null &&
        typeof (todo as TodoItem).id === 'string' &&
        typeof (todo as TodoItem).title === 'string' &&
        typeof (todo as TodoItem).completed === 'boolean' &&
        typeof (todo as TodoItem).createdAt === 'string',
    );
  } catch {
    return [];
  }
};

export const TasksView: React.FC<TasksViewProps> = ({ tasks = [], onAddTask }) => {
  const [todos, setTodos] = useState<TodoItem[]>(readTodos);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch {
      // Local storage can be unavailable in private browsing or restricted contexts.
    }
  }, [todos]);

  const activeCount = todos.filter((todo) => !todo.completed).length;
  const completedCount = todos.length - activeCount;

  const visibleTodos = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return todos.filter((todo) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && !todo.completed) ||
        (filter === 'completed' && todo.completed);
      const matchesSearch = !normalizedSearch || todo.title.toLowerCase().includes(normalizedSearch);
      return matchesFilter && matchesSearch;
    });
  }, [todos, filter, search]);

  const addTodo = (event: React.FormEvent) => {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;

    setTodos((current) => [
      { id: crypto.randomUUID(), title, completed: false, createdAt: new Date().toISOString() },
      ...current,
    ]);
    setDraft('');
  };

  const toggleTodo = (id: string) => {
    setTodos((current) =>
      current.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo)),
    );
  };

  const deleteTodo = (id: string) => {
    setTodos((current) => current.filter((todo) => todo.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const saveEdit = (id: string) => {
    const title = editingTitle.trim();
    if (!title) return;

    setTodos((current) =>
      current.map((todo) => (todo.id === id ? { ...todo, title } : todo)),
    );
    setEditingId(null);
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-white to-cyan-50/40 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-600 text-white shadow-lg shadow-cyan-600/20">
              <ListTodo className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-600">Personal workspace</p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">My to-do list</h1>
              <p className="mt-1 text-sm text-slate-500">Simple, focused, and saved in this browser.</p>
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-slate-900">{activeCount}</p>
            <p className="text-xs font-medium text-slate-500">items left</p>
          </div>
        </header>

        <form onSubmit={addTodo} className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="What needs to be done?"
            aria-label="New to-do"
            className="min-w-0 flex-1 rounded-xl border border-transparent bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </form>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search to-dos"
                aria-label="Search to-dos"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              />
            </div>
            <div className="flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Filter to-dos">
              {(['all', 'active', 'completed'] as Filter[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={filter === option}
                  onClick={() => setFilter(option)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition ${filter === option ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {visibleTodos.map((todo) => (
              <div key={todo.id} className={`group flex items-center gap-3 px-4 py-4 transition hover:bg-slate-50 sm:px-6 ${todo.completed ? 'bg-slate-50/60' : ''}`}>
                <button type="button" onClick={() => toggleTodo(todo.id)} aria-label={todo.completed ? `Mark ${todo.title} active` : `Complete ${todo.title}`} className="shrink-0 text-cyan-600 transition hover:scale-110">
                  {todo.completed ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6 text-slate-300" />}
                </button>

                {editingId === todo.id ? (
                  <input
                    autoFocus
                    value={editingTitle}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') saveEdit(todo.id);
                      if (event.key === 'Escape') setEditingId(null);
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-cyan-400 px-3 py-2 text-sm text-slate-900 outline-none ring-2 ring-cyan-100"
                    aria-label="Edit to-do"
                  />
                ) : (
                  <span className={`min-w-0 flex-1 break-words text-sm ${todo.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                    {todo.title}
                  </span>
                )}

                <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                  {editingId === todo.id ? (
                    <>
                      <button type="button" onClick={() => saveEdit(todo.id)} aria-label="Save to-do" className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50">
                        <Check className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} aria-label="Cancel editing" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(todo.id);
                          setEditingTitle(todo.title);
                        }}
                        aria-label={`Edit ${todo.title}`}
                        className="rounded-lg p-2 text-slate-400 hover:bg-cyan-50 hover:text-cyan-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTodo(todo.id)}
                        aria-label={`Delete ${todo.title}`}
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {visibleTodos.length === 0 && (
              <div className="px-6 py-14 text-center">
                <Circle className="mx-auto h-10 w-10 text-slate-200" />
                <p className="mt-3 text-sm font-semibold text-slate-600">{todos.length === 0 ? 'Your list is clear' : 'No matching to-dos'}</p>
                <p className="mt-1 text-xs text-slate-400">{todos.length === 0 ? 'Add your first item above to get started.' : 'Try another filter or search term.'}</p>
              </div>
            )}
          </div>

          <footer className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <span>
              {todos.length} total · {completedCount} completed
            </span>
            {completedCount > 0 && (
              <button
                type="button"
                onClick={() => setTodos((current) => current.filter((todo) => !todo.completed))}
                className="font-semibold text-slate-500 hover:text-red-600"
              >
                Clear completed
              </button>
            )}
          </footer>
        </section>

        <p className="text-center text-xs text-slate-400">Your to-dos are stored locally and remain available when you return to this browser.</p>
      </div>
    </div>
  );
};

export default TasksView;
