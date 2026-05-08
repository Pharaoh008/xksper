"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon, GripVertical } from "lucide-react"

import { cn } from "@/lib/utils"

function DraggableDialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  const [position, setPosition] = React.useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = React.useState(false)
  const dragStartRef = React.useRef({ x: 0, y: 0, posX: 0, posY: 0 })
  const contentRef = React.useRef<HTMLDivElement>(null)
  const headerRef = React.useRef<HTMLDivElement>(null)

  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    // 只有点击标题栏或其子元素（除了按钮）才触发拖拽
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('[data-no-drag]')) {
      return
    }
    
    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    }
  }, [position])

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (!isDragging) return
    
    const deltaX = e.clientX - dragStartRef.current.x
    const deltaY = e.clientY - dragStartRef.current.y
    
    setPosition({
      x: dragStartRef.current.posX + deltaX,
      y: dragStartRef.current.posY + deltaY,
    })
  }, [isDragging])

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false)
  }, [])

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  return (
    <DialogPrimitive.Portal data-slot="dialog-portal">
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50"
      />
      <DialogPrimitive.Content
        ref={contentRef}
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-sm:max-w-[calc(100%-2rem)] gap-4 rounded-lg border p-6 shadow-lg duration-200 max-w-lg",
          isDragging && "cursor-grabbing select-none",
          className
        )}
        style={{
          transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
        }}
        {...props}
      >
        {/* 拖拽手柄 - 仅在 header 没有时显示 */}
        <div
          ref={headerRef}
          onMouseDown={handleMouseDown}
          className={cn(
            "absolute -top-3 left-1/2 -translate-x-1/2 flex items-center justify-center w-12 h-6 rounded-full bg-border cursor-grab hover:bg-muted transition-colors",
            isDragging && "cursor-grabbing"
          )}
          title="拖拽移动"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
        
        {children}
        
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            data-no-drag
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity enabled:hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function DraggableDialogHeader({ 
  className, 
  children,
  onMouseDown,
  ...props 
}: React.ComponentProps<"div"> & { onMouseDown?: (e: React.MouseEvent) => void }) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export {
  DraggableDialogContent,
  DraggableDialogHeader,
}
