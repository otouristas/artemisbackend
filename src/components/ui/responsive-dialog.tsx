import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

const ResponsiveDialogContext = React.createContext(false);

interface ResponsiveDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

/**
 * Centered Dialog on desktop, vaul bottom sheet on mobile.
 * Sub-components map 1:1 to their Dialog/Drawer counterparts.
 */
function ResponsiveDialog({ open, onOpenChange, children }: ResponsiveDialogProps) {
  const isMobile = useIsMobile();
  const Root = isMobile ? Drawer : Dialog;
  return (
    <ResponsiveDialogContext.Provider value={isMobile}>
      <Root open={open} onOpenChange={onOpenChange}>
        {children}
      </Root>
    </ResponsiveDialogContext.Provider>
  );
}

interface ResponsiveDialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Extra classes applied only to the mobile sheet */
  sheetClassName?: string;
}

const ResponsiveDialogContent = React.forwardRef<HTMLDivElement, ResponsiveDialogContentProps>(
  ({ className, sheetClassName, children, ...props }, ref) => {
    const isMobile = React.useContext(ResponsiveDialogContext);
    if (isMobile) {
      return (
        <DrawerContent ref={ref} className={sheetClassName} {...props}>
          <div className="px-4">{children}</div>
        </DrawerContent>
      );
    }
    return (
      <DialogContent ref={ref} className={className} {...props}>
        {children}
      </DialogContent>
    );
  },
);
ResponsiveDialogContent.displayName = "ResponsiveDialogContent";

function ResponsiveDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const isMobile = React.useContext(ResponsiveDialogContext);
  const Comp = isMobile ? DrawerHeader : DialogHeader;
  return <Comp className={cn(isMobile && "px-0", className)} {...props} />;
}

const ResponsiveDialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ ...props }, ref) => {
  const isMobile = React.useContext(ResponsiveDialogContext);
  const Comp = isMobile ? DrawerTitle : DialogTitle;
  return <Comp ref={ref} {...props} />;
});
ResponsiveDialogTitle.displayName = "ResponsiveDialogTitle";

const ResponsiveDialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ ...props }, ref) => {
  const isMobile = React.useContext(ResponsiveDialogContext);
  const Comp = isMobile ? DrawerDescription : DialogDescription;
  return <Comp ref={ref} {...props} />;
});
ResponsiveDialogDescription.displayName = "ResponsiveDialogDescription";

/** Place the primary action first in the DOM: it renders on top in the mobile
 *  sheet and rightmost in the desktop dialog. */
function ResponsiveDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const isMobile = React.useContext(ResponsiveDialogContext);
  const Comp = isMobile ? DrawerFooter : DialogFooter;
  return (
    <Comp
      className={cn(isMobile ? "px-0" : "sm:flex-row-reverse sm:justify-start sm:space-x-reverse", className)}
      {...props}
    />
  );
}

function ResponsiveDialogClose(props: React.ComponentProps<typeof DialogClose>) {
  const isMobile = React.useContext(ResponsiveDialogContext);
  const Comp = isMobile ? DrawerClose : DialogClose;
  return <Comp {...props} />;
}

export {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogClose,
};
