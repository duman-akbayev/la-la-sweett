// =============================================================================
// La La Sweett Sales System — /api/orders POST Handler
// =============================================================================
// Validates: Requirements 2.2, 2.3, 11.1, 11.2, 11.7

import { NextRequest, NextResponse } from 'next/server';
import { createOrderIntent } from '@/services/order.service';
import type { OrderIntentData, APIError, ValidationFieldError } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_LEAD_TIME_DAYS = 7;
const MAX_SERVINGS = 500;
const MIN_SERVINGS = 10;
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_PHONE_LENGTH = 20;
const MAX_DESCRIPTION_LENGTH = 1000;

const SCRIPT_TAG_REGEX = /<script[\s>]/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DIGITS_ONLY_REGEX = /^\d+$/;

const VALID_BUDGET_RANGES = [
  '$50 – $100',
  '$100 – $200',
  '$200 – $350',
  '$350 – $500',
  '$500+',
];

// ---------------------------------------------------------------------------
// CSRF Protection
// ---------------------------------------------------------------------------

/**
 * Validates CSRF protection via Origin/Referer header check.
 * This is a simple same-origin validation approach suitable for JSON APIs.
 */
function validateCsrf(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');

  // For JSON APIs, the Content-Type: application/json header combined with
  // origin/referer validation provides CSRF protection since browsers won't
  // send custom content-type headers in cross-origin simple requests.
  const contentType = request.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return false;
  }

  // If origin is present, it must match host
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (host && originUrl.host === host) {
        return true;
      }
    } catch {
      return false;
    }
  }

  // Fall back to referer check
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (host && refererUrl.host === host) {
        return true;
      }
    } catch {
      return false;
    }
  }

  // In development, allow requests without origin/referer (e.g., from test runners)
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface OrderFormBody {
  eventDate?: string;
  servings?: string | number;
  flavor?: string;
  designDescription?: string;
  budgetRange?: string;
  name?: string;
  email?: string;
  phone?: string;
}

function validateOrderForm(body: OrderFormBody): ValidationFieldError[] {
  const errors: ValidationFieldError[] = [];

  // Event Date
  const eventDate = (body.eventDate ?? '').toString().trim();
  if (!eventDate) {
    errors.push({ field: 'eventDate', reason: 'Event date is required' });
  } else {
    const selectedDate = new Date(eventDate + 'T00:00:00');
    if (isNaN(selectedDate.getTime())) {
      errors.push({ field: 'eventDate', reason: 'Event date is not a valid date' });
    } else {
      const minDate = new Date();
      minDate.setHours(0, 0, 0, 0);
      minDate.setDate(minDate.getDate() + MIN_LEAD_TIME_DAYS);
      if (selectedDate < minDate) {
        errors.push({
          field: 'eventDate',
          reason: `Event date must be at least ${MIN_LEAD_TIME_DAYS} days from today`,
        });
      }
    }
  }

  // Servings
  const servingsRaw = body.servings;
  const servingsStr = (servingsRaw ?? '').toString().trim();
  if (!servingsStr) {
    errors.push({ field: 'servings', reason: 'Number of servings is required' });
  } else {
    const num = parseInt(servingsStr, 10);
    if (isNaN(num)) {
      errors.push({ field: 'servings', reason: 'Servings must be a number' });
    } else if (num < MIN_SERVINGS) {
      errors.push({ field: 'servings', reason: `Minimum servings is ${MIN_SERVINGS}` });
    } else if (num > MAX_SERVINGS) {
      errors.push({ field: 'servings', reason: `Maximum servings is ${MAX_SERVINGS}` });
    }
  }

  // Flavor
  const flavor = (body.flavor ?? '').toString().trim();
  if (!flavor) {
    errors.push({ field: 'flavor', reason: 'Please select a flavor' });
  }

  // Design Description
  const designDescription = (body.designDescription ?? '').toString().trim();
  if (!designDescription) {
    errors.push({ field: 'designDescription', reason: 'Design description is required' });
  } else if (designDescription.length > MAX_DESCRIPTION_LENGTH) {
    errors.push({
      field: 'designDescription',
      reason: `Design description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`,
    });
  } else if (SCRIPT_TAG_REGEX.test(designDescription)) {
    errors.push({ field: 'designDescription', reason: 'Invalid characters detected' });
  }

  // Budget Range
  const budgetRange = (body.budgetRange ?? '').toString().trim();
  if (!budgetRange) {
    errors.push({ field: 'budgetRange', reason: 'Please select a budget range' });
  } else if (!VALID_BUDGET_RANGES.includes(budgetRange)) {
    errors.push({ field: 'budgetRange', reason: 'Invalid budget range selected' });
  }

  // Name
  const name = (body.name ?? '').toString().trim();
  if (!name) {
    errors.push({ field: 'name', reason: 'Full name is required' });
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.push({
      field: 'name',
      reason: `Name must be ${MAX_NAME_LENGTH} characters or fewer`,
    });
  } else if (SCRIPT_TAG_REGEX.test(name)) {
    errors.push({ field: 'name', reason: 'Invalid characters detected' });
  }

  // Email
  const email = (body.email ?? '').toString().trim();
  if (!email) {
    errors.push({ field: 'email', reason: 'Email address is required' });
  } else if (email.length > MAX_EMAIL_LENGTH) {
    errors.push({
      field: 'email',
      reason: `Email must be ${MAX_EMAIL_LENGTH} characters or fewer`,
    });
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push({ field: 'email', reason: 'Please enter a valid email address' });
  }

  // Phone
  const phone = (body.phone ?? '').toString().trim();
  if (!phone) {
    errors.push({ field: 'phone', reason: 'Phone number is required' });
  } else if (phone.length > MAX_PHONE_LENGTH) {
    errors.push({
      field: 'phone',
      reason: `Phone must be ${MAX_PHONE_LENGTH} characters or fewer`,
    });
  } else if (!DIGITS_ONLY_REGEX.test(phone)) {
    errors.push({ field: 'phone', reason: 'Phone number must contain only digits' });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Email confirmation stub
// ---------------------------------------------------------------------------

/**
 * Sends a confirmation email to the customer.
 * Currently a stub that logs the email — actual integration requires SMTP config.
 */
async function sendConfirmationEmail(
  email: string,
  customerName: string,
  orderDetails: { eventDate: string; servings: number; flavor: string; budgetRange: string }
): Promise<void> {
  // Log the confirmation email (stub for actual SMTP integration)
  console.log(
    `[EMAIL] Confirmation sent to ${email} for ${customerName}:`,
    JSON.stringify({
      to: email,
      subject: 'La La Sweett — Order Inquiry Received!',
      body: `Hi ${customerName}, we've received your order inquiry for ${orderDetails.servings} servings (${orderDetails.flavor}) on ${orderDetails.eventDate}. Budget: ${orderDetails.budgetRange}. We'll get back to you within 1-2 business days with a custom quote!`,
      sentAt: new Date().toISOString(),
    })
  );
}

// ---------------------------------------------------------------------------
// POST /api/orders
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // CSRF validation
    if (!validateCsrf(request)) {
      const errorResponse: APIError = {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid request origin',
        },
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    // Parse request body
    let body: OrderFormBody;
    try {
      body = await request.json();
    } catch {
      const errorResponse: APIError = {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid request body',
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Validate form fields
    const validationErrors = validateOrderForm(body);
    if (validationErrors.length > 0) {
      const errorResponse: APIError = {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Please correct the errors below and try again',
          fields: validationErrors,
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Build OrderIntentData from validated body
    const orderData: OrderIntentData = {
      eventDate: new Date(body.eventDate!.trim() + 'T00:00:00'),
      servings: parseInt(body.servings!.toString().trim(), 10),
      flavorPreference: body.flavor!.trim(),
      designDescription: body.designDescription!.trim(),
      budgetRange: body.budgetRange!.trim(),
      customerName: body.name!.trim(),
      customerEmail: body.email!.trim(),
      customerPhone: body.phone!.trim(),
    };

    // Create Order_Intent record
    const order = await createOrderIntent(orderData);

    // Send confirmation email (non-blocking, within 60 seconds requirement)
    sendConfirmationEmail(orderData.customerEmail, orderData.customerName, {
      eventDate: body.eventDate!.trim(),
      servings: orderData.servings,
      flavor: orderData.flavorPreference,
      budgetRange: orderData.budgetRange,
    }).catch((err) => {
      console.error('[EMAIL] Failed to send confirmation:', err);
    });

    // Return success response
    return NextResponse.json(
      {
        success: true,
        data: {
          orderId: order.id,
          state: order.state,
          eventDate: order.eventDate,
          servings: order.servings,
          createdAt: order.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    // Log error internally but do not expose details to client
    console.error('[API /api/orders] Internal error:', error);

    const errorResponse: APIError = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again later.',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
