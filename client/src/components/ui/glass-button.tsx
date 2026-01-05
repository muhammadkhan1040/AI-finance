import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { Slot } from "@radix-ui/react-slot";

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
  isLoading?: boolean;
  asChild?: boolean;
}

export function GlassButton({ 
  children, 
  className, 
  variant = "primary", 
  isLoading,
  disabled,
  asChild = false,
  ...props 
}: GlassButtonProps) {
  const Comp = asChild ? Slot : "button";
  const baseStyles = "relative inline-flex items-center justify-center px-6 py-3 rounded-full font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95";
  
  const variants = {
    primary: "bg-gradient-to-r from-[#5cffb5] to-[#0fd0ff] text-slate-900 shadow-[0_0_20px_rgba(15,208,255,0.5)] hover:shadow-[0_0_30px_rgba(15,208,255,0.7)] hover:-translate-y-0.5 border-none",
    secondary: "bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:border-white/30 backdrop-blur-md",
    outline: "bg-transparent border border-[#5cffb5]/50 text-[#5cffb5] hover:bg-[#5cffb5]/10 shadow-[0_0_10px_rgba(92,255,181,0.2)]"
  };

  return (
    <Comp 
      className={cn(baseStyles, variants[variant], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </Comp>
  );
}
