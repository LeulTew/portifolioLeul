import { useEffect, useRef, useState } from 'react';
import { ContactFormData, FormErrors } from './types';
import {
  ContactDeliveryError,
  getContactDeliveryConfig,
  sendContactMessage,
  type ContactDeliveryFailure,
} from './contactDelivery';
import { CONTACT_LIMITS } from './contactLimits';
import { requestReveal } from '@/lib/scroll/layerFocus';

const FIELDS = ['name', 'email', 'message'] as const;

function fieldOf(form: HTMLFormElement | null | undefined, name: keyof ContactFormData) {
  const field = form?.elements.namedItem(name);
  return field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement ? field : null;
}

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

  /** The draft's own rules, and the browser's constraints on the fields, reported in one voice. */
  const validateForm = (form?: HTMLFormElement | null): keyof ContactFormData | null => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length > CONTACT_LIMITS.name) {
      newErrors.name = `Please keep your name under ${CONTACT_LIMITS.name} characters`;
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (formData.email.length > CONTACT_LIMITS.email || fieldOf(form, 'email')?.validity.typeMismatch ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    } else if (formData.message.length > CONTACT_LIMITS.message) {
      newErrors.message = `Please keep the message under ${CONTACT_LIMITS.message.toLocaleString('en-US')} characters`;
    }

    // A constraint the rules above do not name still gets a message, never a silent block.
    for (const name of FIELDS) {
      if (!newErrors[name] && fieldOf(form, name)?.validity.valid === false) newErrors[name] = 'Please check this field';
    }

    setErrors(newErrors);
    return FIELDS.find(name => newErrors[name]) ?? null;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending.current || accepted.current) return;
    setSubmitStatus('idle');
    setSubmitError(null);
    const invalidField = validateForm(e.currentTarget);
    if (invalidField) {
      const field = fieldOf(e.currentTarget, invalidField);
      field?.focus();
      // Clear of the navbar, as a field the browser's own validation focuses is (round 8, D-A11Y-002).
      if (field) requestReveal(field);
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

  /*
   * The browser's constraints still decide (`required`, `type="email"`, `maxlength`): a blank or
   * malformed draft is still never submitted. Only the report is the form's own. Cancelling each
   * `invalid` keeps the browser's bubble off the design, and the form focuses the first field in
   * its place, as the browser would, so the page's reveal of a validated field is unchanged.
   */
  const handleInvalid = (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.preventDefault();
    if (pending.current || accepted.current) return;
    const form = e.currentTarget.form;
    const first = validateForm(form);
    if (first) fieldOf(form, first)?.focus();
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
    handleInvalid,
    handleChange,
    resetForm,
  };
}