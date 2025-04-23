import React from 'react';
import { motion } from 'framer-motion';

interface FormFieldProps {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error?: string;
  textarea?: boolean;
}

export default function FormField({
  label,
  id,
  type = 'text',
  value,
  onChange,
  error,
  textarea = false,
}: FormFieldProps) {
  const InputComponent = textarea ? 'textarea' : 'input';
  
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <InputComponent
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        rows={textarea ? 4 : undefined}
        className={`w-full px-4 py-2 rounded-lg border ${
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-gray-300 dark:border-gray-700 focus:ring-primary-500'
        } bg-white dark:bg-gray-900 focus:ring-2 focus:border-transparent transition-colors`}
      />
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-red-500"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}