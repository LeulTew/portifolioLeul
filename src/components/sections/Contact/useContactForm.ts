import { useEffect, useRef, useState } from 'react';
import { ContactFormData, FormErrors } from './types';
import {
  ContactDeliveryError,
  getContactDeliveryConfig,
  sendContactMessage,
  type ContactDeliveryFailure,
} from './contactDelivery';

export function useContactForm(submitFn?: (signal: AbortSignal) => Promise<void>) {
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    message: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState<ContactDeliveryFailure | null>(null);
  const pending = useRef(false);
  const accepted = useRef(false);
  const mounted = useRef(true);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeRequest.current?.abort();
      activeRequest.current = null;
      pending.current = false;
    };
  }, []);

  const validateForm = (): keyof ContactFormData | null => {
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
    return newErrors.name ? 'name' : newErrors.email ? 'email' : newErrors.message ? 'message' : null;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending.current || accepted.current) return;
    setSubmitStatus('idle');
    setSubmitError(null);
    const invalidField = validateForm();
    if (invalidField) {
      e.currentTarget.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${invalidField}"]`)?.focus();
      return;
    }

    const request = new AbortController();
    activeRequest.current = request;
    pending.current = true;
    setIsSubmitting(true);

    try {
      if (submitFn) {
        await submitFn(request.signal);
      } else {
        await sendContactMessage(formData, getContactDeliveryConfig(), request.signal);
      }
      if (mounted.current && activeRequest.current === request && !request.signal.aborted) {
        accepted.current = true;
        setSubmitStatus('success');
      }
    } catch (error) {
      if (mounted.current && activeRequest.current === request && !request.signal.aborted) {
        const failure = error instanceof ContactDeliveryError ? error : new ContactDeliveryError('network');
        console.error('Contact submission failed:', failure);
        setSubmitError(failure.kind);
        setSubmitStatus('error');
      }
    } finally {
      if (activeRequest.current === request) {
        activeRequest.current = null;
        pending.current = false;
        if (mounted.current) setIsSubmitting(false);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (pending.current) return;
    const { name, value } = e.target;
    accepted.current = false;
    setSubmitStatus('idle');
    setSubmitError(null);
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const resetForm = () => {
    if (pending.current) return;
    accepted.current = false;
    setFormData({ name: '', email: '', message: '' });
    setErrors({});
    setSubmitStatus('idle');
    setSubmitError(null);
  };

  return {
    formData,
    errors,
    isSubmitting,
    submitStatus,
    submitError,
    handleSubmit,
    handleChange,
    resetForm,
  };
}