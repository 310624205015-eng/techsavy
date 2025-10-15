import React from 'react';

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
interface FormTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export const FormInput = ({ className, ...props }: FormInputProps) => (
  <input
    {...props}
    className={`w-full bg-black/40 border border-zinc-800 rounded-lg px-4 py-3 text-white text-base mb-4 
      focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder-zinc-600
      transition-all duration-200 ${className || ''}`}
  />
);

export const FormTextArea = ({ className, ...props }: FormTextAreaProps) => (
  <textarea
    {...props}
    className={`w-full bg-black/40 border border-zinc-800 rounded-lg px-4 py-3 text-white text-base mb-4 
      focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder-zinc-600 
      resize-none transition-all duration-200 ${className || ''}`}
  />
);

export const Button = ({ variant = 'primary', className, ...props }: ButtonProps) => {
  const baseStyles = "px-4 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2";
  const variants = {
    primary: "bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-400 shadow-lg shadow-red-500/20",
    secondary: "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-800",
    danger: "bg-black/60 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/50"
  };
  return <button {...props} className={[baseStyles, variants[variant], className].filter(Boolean).join(' ')} />;
};