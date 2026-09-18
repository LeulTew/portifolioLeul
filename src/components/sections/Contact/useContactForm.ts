import { useRef, useState } from 'react';
import { ContactFormData, FormErrors } from './types';
import emailjs from '@emailjs/browser';

export function useContactForm(submitFn?: () => Promise<void>) {
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    message: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const pending = useRef(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending.current) return;
    setSubmitStatus('idle');
    if (!validateForm()) return;

    pending.current = true;
    setIsSubmitting(true);

    try {
      if (submitFn) {
        await submitFn();
      } else {
        const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID?.trim() || '';
        const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID?.trim() || '';
        const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY?.trim() || '';

        if (SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY) {
          await emailjs.send(
            SERVICE_ID,
            TEMPLATE_ID,
            {
              from_name: formData.name.trim(),
              from_email: formData.email.trim(),
              message: formData.message,
            },
            PUBLIC_KEY
          );
        } else {
          throw new Error('EmailJS configuration is incomplete.');
        }
      }
      setSubmitStatus('success');
      setFormData({ name: '', email: '', message: '' });
    } catch (error) {
      console.error('EmailJS Error:', error);
      setSubmitStatus('error');
    } finally {
      pending.current = false;
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (pending.current) return;
    const { name, value } = e.target;
    setSubmitStatus('idle');
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  return {
    formData,
    errors,
    isSubmitting,
    submitStatus,
    handleSubmit,
    handleChange,
  };
}