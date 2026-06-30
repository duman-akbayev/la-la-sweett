'use client';

// =============================================================================
// La La Sweett — Order Inquiry Form Page
// =============================================================================

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FEATURES } from '@/lib/feature-flags';
import { ContactCallout } from '@/components/ContactCallout';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUDGET_RANGES = [
  '$50 – $100',
  '$100 – $200',
  '$200 – $350',
  '$350 – $500',
  '$500+',
] as const;

const MIN_LEAD_TIME_DAYS = 7;
const MAX_SERVINGS = 500;
const MIN_SERVINGS = 10;
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_PHONE_LENGTH = 20;
const MAX_DESCRIPTION_LENGTH = 1000;

// ---------------------------------------------------------------------------
// Validation Helpers
// ---------------------------------------------------------------------------

const SCRIPT_TAG_REGEX = /<script[\s>]/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DIGITS_ONLY_REGEX = /^\d+$/;

interface FormData {
  eventDate: string;
  servings: string;
  flavor: string;
  designDescription: string;
  budgetRange: string;
  name: string;
  email: string;
  phone: string;
}

interface FormErrors {
  eventDate?: string;
  servings?: string;
  flavor?: string;
  designDescription?: string;
  budgetRange?: string;
  name?: string;
  email?: string;
  phone?: string;
}

function getMinDateString(): string {
  const date = new Date();
  date.setDate(date.getDate() + MIN_LEAD_TIME_DAYS);
  return date.toISOString().split('T')[0];
}

function containsScriptTag(value: string): boolean {
  return SCRIPT_TAG_REGEX.test(value);
}

function validateField(field: keyof FormData, value: string): string | undefined {
  const trimmed = value.trim();

  switch (field) {
    case 'eventDate': {
      if (!trimmed) return 'Event date is required';
      const selectedDate = new Date(trimmed + 'T00:00:00');
      const minDate = new Date();
      minDate.setHours(0, 0, 0, 0);
      minDate.setDate(minDate.getDate() + MIN_LEAD_TIME_DAYS);
      if (selectedDate < minDate) {
        return `Event date must be at least ${MIN_LEAD_TIME_DAYS} days from today. Minimum date: ${minDate.toLocaleDateString()}`;
      }
      return undefined;
    }
    case 'servings': {
      if (!trimmed) return 'Number of servings is required';
      const num = parseInt(trimmed, 10);
      if (isNaN(num)) return 'Servings must be a number';
      if (num < MIN_SERVINGS) return `Minimum servings is ${MIN_SERVINGS}`;
      if (num > MAX_SERVINGS) return `Maximum servings is ${MAX_SERVINGS}`;
      return undefined;
    }
    case 'flavor': {
      if (!trimmed) return 'Please select a flavor';
      return undefined;
    }
    case 'designDescription': {
      if (!trimmed) return 'Design description is required';
      if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
        return `Design description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`;
      }
      if (containsScriptTag(trimmed)) return 'Invalid characters detected';
      return undefined;
    }
    case 'budgetRange': {
      if (!trimmed) return 'Please select a budget range';
      return undefined;
    }
    case 'name': {
      if (!trimmed) return 'Full name is required';
      if (trimmed.length > MAX_NAME_LENGTH) {
        return `Name must be ${MAX_NAME_LENGTH} characters or fewer`;
      }
      if (containsScriptTag(trimmed)) return 'Invalid characters detected';
      return undefined;
    }
    case 'email': {
      if (!trimmed) return 'Email address is required';
      if (trimmed.length > MAX_EMAIL_LENGTH) {
        return `Email must be ${MAX_EMAIL_LENGTH} characters or fewer`;
      }
      if (!EMAIL_REGEX.test(trimmed)) return 'Please enter a valid email address';
      return undefined;
    }
    case 'phone': {
      if (!trimmed) return 'Phone number is required';
      if (trimmed.length > MAX_PHONE_LENGTH) {
        return `Phone must be ${MAX_PHONE_LENGTH} characters or fewer`;
      }
      if (!DIGITS_ONLY_REGEX.test(trimmed)) {
        return 'Phone number must contain only digits';
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

function validateForm(data: FormData): FormErrors {
  const errors: FormErrors = {};
  for (const field of Object.keys(data) as (keyof FormData)[]) {
    const error = validateField(field, data[field]);
    if (error) {
      errors[field] = error;
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

// Page entry point. While the Order Inquiry form is temporarily disabled
// (SHOW_ORDER_INQUIRY = false), this route shows the warm "call/text us"
// callout instead of the form. The full form component below is preserved
// intact — flip the flag back on to restore it.
export default function OrderPage() {
  if (!FEATURES.SHOW_ORDER_INQUIRY) {
    return <ContactCallout />;
  }
  return <OrderInquiryForm />;
}

function OrderInquiryForm() {
  const [flavors, setFlavors] = useState<string[]>([]);
  const [flavorsLoading, setFlavorsLoading] = useState(true);
  const [formData, setFormData] = useState<FormData>({
    eventDate: '',
    servings: '',
    flavor: '',
    designDescription: '',
    budgetRange: '',
    name: '',
    email: '',
    phone: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<keyof FormData, boolean>>({
    eventDate: false,
    servings: false,
    flavor: false,
    designDescription: false,
    budgetRange: false,
    name: false,
    email: false,
    phone: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch available flavors from Catalog Service
  useEffect(() => {
    async function loadFlavors() {
      try {
        const res = await fetch('/api/catalog.json');
        if (res.ok) {
          const data = await res.json();
          const allFlavors = new Set<string>();
          if (data.products) {
            for (const product of data.products) {
              if (product.flavors && Array.isArray(product.flavors)) {
                for (const flavor of product.flavors) {
                  allFlavors.add(flavor);
                }
              }
            }
          }
          setFlavors(Array.from(allFlavors).sort());
        }
      } catch {
        setFlavors([
          'Vanilla',
          'Chocolate',
          'Red Velvet',
          'Lemon',
          'Strawberry',
          'Funfetti',
          'Carrot',
          'Coconut',
        ]);
      } finally {
        setFlavorsLoading(false);
      }
    }
    loadFlavors();
  }, []);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (touched[name as keyof FormData]) {
      const error = validateField(name as keyof FormData, value);
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  }

  function handleBlur(
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = validateField(name as keyof FormData, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const allTouched = Object.keys(formData).reduce(
      (acc, key) => ({ ...acc, [key]: true }),
      {} as Record<keyof FormData, boolean>
    );
    setTouched(allTouched);

    const formErrors = validateForm(formData);
    setErrors(formErrors);

    if (Object.keys(formErrors).length > 0) {
      const firstErrorField = Object.keys(formErrors)[0];
      const element = document.getElementById(firstErrorField);
      element?.focus();
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setSubmitSuccess(true);
      } else {
        const errorData = await res.json().catch(() => null);
        if (errorData?.error?.fields) {
          const serverErrors: FormErrors = {};
          for (const fieldError of errorData.error.fields) {
            serverErrors[fieldError.field as keyof FormData] = fieldError.reason;
          }
          setErrors(serverErrors);
        } else {
          setSubmitError(
            errorData?.error?.message || 'Something went wrong. Please try again.'
          );
        }
      }
    } catch {
      setSubmitError(
        'Unable to submit your inquiry. Please check your connection and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Success state
  if (submitSuccess) {
    return (
      <main className="min-h-screen bg-brand-ivory px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl bg-white p-8 text-center shadow-card sm:p-12">
            <div className="mb-4 text-5xl" aria-hidden="true">
              🎉
            </div>
            <h1 className="font-display text-3xl text-brand-brown">
              Inquiry Submitted!
            </h1>
            <p className="mt-4 text-lg text-brand-espresso/80">
              Thank you for your interest in La La Sweett! We&apos;ve received your
              order inquiry and will get back to you within 1-2 business days with a
              custom quote.
            </p>
            <p className="mt-3 text-sm text-brand-taupe">
              A confirmation email has been sent to your email address.
            </p>
            <Link
              href="/"
              className="mt-8 inline-block rounded-full bg-brand-rose px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-rose/90"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-brand-ivory px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center gap-2 text-sm text-brand-taupe">
            <li>
              <Link href="/" className="hover:text-brand-rose transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-brand-rose">
              Order Inquiry
            </li>
          </ol>
        </nav>

        {/* Page Header */}
        <header className="mb-8">
          <h1 className="font-display text-3xl text-brand-brown sm:text-4xl">
            Order Inquiry
          </h1>
          <p className="mt-3 text-lg text-brand-espresso/80">
            Tell us about your dream cake! Fill out the form below and we&apos;ll get
            back to you with a custom quote.
          </p>
        </header>

        {/* Lead Time & Deposit Info */}
        <section
          aria-label="Important order information"
          className="mb-8 rounded-2xl border border-brand-rose/20 bg-white p-5 shadow-card"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-rose">
            Before You Order
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-brand-espresso/80">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-brand-rose" aria-hidden="true">
                ⏱
              </span>
              <span>
                <strong className="text-brand-espresso">Lead time:</strong> Custom orders
                require a minimum of 1–2 weeks advance notice. Please plan accordingly!
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-brand-rose" aria-hidden="true">
                💰
              </span>
              <span>
                <strong className="text-brand-espresso">Deposit:</strong> A 50% deposit is
                required to book your order. The remaining balance is due upon
                pickup/delivery.
              </span>
            </li>
          </ul>
        </section>

        {/* Order Form */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-6 rounded-2xl bg-white p-6 shadow-card sm:p-8"
        >
          {/* Submit error banner */}
          {submitError && (
            <div
              role="alert"
              className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700"
            >
              {submitError}
            </div>
          )}

          {/* Event Date */}
          <FieldWrapper
            id="eventDate"
            label="Event Date"
            error={touched.eventDate ? errors.eventDate : undefined}
            required
          >
            <input
              type="date"
              id="eventDate"
              name="eventDate"
              value={formData.eventDate}
              onChange={handleChange}
              onBlur={handleBlur}
              min={getMinDateString()}
              required
              aria-invalid={touched.eventDate && !!errors.eventDate}
              aria-describedby={errors.eventDate ? 'eventDate-error' : undefined}
              className={inputClasses(touched.eventDate && !!errors.eventDate)}
            />
          </FieldWrapper>

          {/* Servings */}
          <FieldWrapper
            id="servings"
            label="Number of Servings"
            error={touched.servings ? errors.servings : undefined}
            required
            hint={`Between ${MIN_SERVINGS} and ${MAX_SERVINGS} servings`}
          >
            <input
              type="number"
              id="servings"
              name="servings"
              value={formData.servings}
              onChange={handleChange}
              onBlur={handleBlur}
              min={MIN_SERVINGS}
              max={MAX_SERVINGS}
              placeholder="e.g. 50"
              required
              aria-invalid={touched.servings && !!errors.servings}
              aria-describedby={
                [errors.servings ? 'servings-error' : '', 'servings-hint']
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              className={inputClasses(touched.servings && !!errors.servings)}
            />
          </FieldWrapper>

          {/* Flavor */}
          <FieldWrapper
            id="flavor"
            label="Flavor Preference"
            error={touched.flavor ? errors.flavor : undefined}
            required
          >
            <select
              id="flavor"
              name="flavor"
              value={formData.flavor}
              onChange={handleChange}
              onBlur={handleBlur}
              required
              aria-invalid={touched.flavor && !!errors.flavor}
              aria-describedby={errors.flavor ? 'flavor-error' : undefined}
              className={inputClasses(touched.flavor && !!errors.flavor)}
            >
              <option value="">
                {flavorsLoading ? 'Loading flavors...' : 'Select a flavor'}
              </option>
              {flavors.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </FieldWrapper>

          {/* Design Description */}
          <FieldWrapper
            id="designDescription"
            label="Design Description"
            error={touched.designDescription ? errors.designDescription : undefined}
            required
            hint={`Describe your dream cake design (max ${MAX_DESCRIPTION_LENGTH} characters)`}
          >
            <textarea
              id="designDescription"
              name="designDescription"
              value={formData.designDescription}
              onChange={handleChange}
              onBlur={handleBlur}
              rows={4}
              maxLength={MAX_DESCRIPTION_LENGTH}
              placeholder="Describe your ideal cake design, theme, colors, decorations..."
              required
              aria-invalid={touched.designDescription && !!errors.designDescription}
              aria-describedby={
                [
                  errors.designDescription ? 'designDescription-error' : '',
                  'designDescription-hint',
                ]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              className={inputClasses(
                touched.designDescription && !!errors.designDescription
              )}
            />
            <p className="mt-1 text-xs text-brand-taupe">
              {formData.designDescription.length}/{MAX_DESCRIPTION_LENGTH} characters
            </p>
          </FieldWrapper>

          {/* Budget Range */}
          <FieldWrapper
            id="budgetRange"
            label="Budget Range"
            error={touched.budgetRange ? errors.budgetRange : undefined}
            required
          >
            <select
              id="budgetRange"
              name="budgetRange"
              value={formData.budgetRange}
              onChange={handleChange}
              onBlur={handleBlur}
              required
              aria-invalid={touched.budgetRange && !!errors.budgetRange}
              aria-describedby={errors.budgetRange ? 'budgetRange-error' : undefined}
              className={inputClasses(touched.budgetRange && !!errors.budgetRange)}
            >
              <option value="">Select your budget range</option>
              {BUDGET_RANGES.map((range) => (
                <option key={range} value={range}>
                  {range}
                </option>
              ))}
            </select>
          </FieldWrapper>

          {/* Divider */}
          <div className="border-t border-brand-rose/10 pt-6">
            <h2 className="mb-4 text-lg font-semibold text-brand-espresso">
              Contact Information
            </h2>
          </div>

          {/* Full Name */}
          <FieldWrapper
            id="name"
            label="Full Name"
            error={touched.name ? errors.name : undefined}
            required
          >
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              onBlur={handleBlur}
              maxLength={MAX_NAME_LENGTH}
              placeholder="Your full name"
              required
              autoComplete="name"
              aria-invalid={touched.name && !!errors.name}
              aria-describedby={errors.name ? 'name-error' : undefined}
              className={inputClasses(touched.name && !!errors.name)}
            />
          </FieldWrapper>

          {/* Email */}
          <FieldWrapper
            id="email"
            label="Email Address"
            error={touched.email ? errors.email : undefined}
            required
          >
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              onBlur={handleBlur}
              maxLength={MAX_EMAIL_LENGTH}
              placeholder="you@example.com"
              required
              autoComplete="email"
              aria-invalid={touched.email && !!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className={inputClasses(touched.email && !!errors.email)}
            />
          </FieldWrapper>

          {/* Phone */}
          <FieldWrapper
            id="phone"
            label="Phone Number"
            error={touched.phone ? errors.phone : undefined}
            required
            hint="Digits only, no dashes or spaces"
          >
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              onBlur={handleBlur}
              maxLength={MAX_PHONE_LENGTH}
              placeholder="5125551234"
              required
              autoComplete="tel"
              aria-invalid={touched.phone && !!errors.phone}
              aria-describedby={
                [errors.phone ? 'phone-error' : '', 'phone-hint']
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              className={inputClasses(touched.phone && !!errors.phone)}
            />
          </FieldWrapper>

          {/* CSRF token placeholder */}
          <input type="hidden" name="_csrf" value="" />

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-brand-rose px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-brand-rose/90 focus:outline-none focus:ring-2 focus:ring-brand-rose focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ minHeight: '44px' }}
          >
            {submitting ? 'Submitting...' : 'Submit Inquiry'}
          </button>

          <p className="text-center text-xs text-brand-taupe">
            By submitting this form, you agree to our{' '}
            <Link href="/policies" className="text-brand-rose hover:underline">
              policies
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-brand-rose hover:underline">
              privacy policy
            </Link>
            .
          </p>
        </form>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Field Wrapper Component
// ---------------------------------------------------------------------------

function FieldWrapper({
  id,
  label,
  error,
  required,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-brand-espresso">
        {label}
        {required && (
          <span className="ml-1 text-brand-rose" aria-label="required">
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mb-1.5 text-xs text-brand-taupe">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared Input Classes
// ---------------------------------------------------------------------------

function inputClasses(hasError: boolean): string {
  const base =
    'w-full rounded-xl border bg-white px-4 py-3 text-brand-espresso placeholder:text-brand-taupe/60 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-rose focus:ring-offset-1 focus:ring-offset-white';
  const height = 'min-h-[44px]';
  const borderColor = hasError
    ? 'border-red-400'
    : 'border-brand-rose/20 focus:border-brand-rose';
  return `${base} ${height} ${borderColor}`;
}
