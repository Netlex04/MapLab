'use client'

import { useActionState, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { createProject, type ProjectState } from '@/app/actions/projects'

const stageOptions = [
  { value: '', label: 'Unknown / N/A' },
  { value: 'Stock', label: 'Stock' },
  { value: 'Stage 1', label: 'Stage 1' },
  { value: 'Stage 2', label: 'Stage 2' },
  { value: 'Stage 3', label: 'Stage 3' },
  { value: 'Stage 4+', label: 'Stage 4+' },
]

export function NewProjectDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<ProjectState, FormData>(
    createProject,
    null,
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl uppercase tracking-wider">
            New Project
          </DialogTitle>
        </DialogHeader>

        <form action={action} className="mt-2 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label
              htmlFor="name"
              className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground"
            >
              Project name *
            </Label>
            <Input
              id="name"
              name="name"
              placeholder="GTI 2.0T Stage 2"
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label
              htmlFor="description"
              className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground"
            >
              Description
            </Label>
            <Input
              id="description"
              name="description"
              placeholder="Optional — what's this tune for?"
            />
          </div>

          {/* ECU Type */}
          <div className="space-y-1.5">
            <Label
              htmlFor="ecuType"
              className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground"
            >
              ECU Type
            </Label>
            <Input
              id="ecuType"
              name="ecuType"
              placeholder="e.g. Bosch MED17.5"
            />
          </div>

          {/* Stage */}
          <div className="space-y-1.5">
            <Label
              htmlFor="stage"
              className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground"
            >
              Stage
            </Label>
            <select
              id="stage"
              name="stage"
              className="flex h-10 w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {stageOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Visibility */}
          <div className="space-y-1.5">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Visibility
            </p>
            <div className="flex gap-2">
              {(['PRIVATE', 'PUBLIC'] as const).map((v) => (
                <label
                  key={v}
                  className="flex flex-1 cursor-pointer items-center gap-2 rounded border border-input bg-background px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={v}
                    defaultChecked={v === 'PRIVATE'}
                    className="accent-primary"
                  />
                  <span>{v === 'PRIVATE' ? 'Private' : 'Public'}</span>
                </label>
              ))}
            </div>
          </div>

          {state && 'error' in state && (
            <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
