// =============================================================================
// La La Sweett Sales System — /api/orders POST Handler Tests
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock the order service
vi.mock('@/services/order.service', () => ({
  createOrderIntent: vi.fn().mockResolvedValue({
    id: 'order-123',
    customerId: 'customer-456',
    state: 'Inquiry',
    eventDate: new Date('2025-08-15'),
    servings: 50,
    flavorPreference: 'Vanilla',
    designDescription: 'A beautiful white cake with gold accents',
    budgetRange: '$200 – $350',
    originatingChannel: 'chat_widget',
    refundFlagged: false,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createValidBody() {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 14);
  const dateStr = futureDate.toISOString().split('T')[0];

  return {
    eventDate: dateStr,
    servings: '50',
    flavor: 'Vanilla',
    designDescription: 'A beautiful white cake with gold accents',
    budgetRange: '$200 – $350',
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '5125551234',
  };
}

function createRequest(body: unknown, options: { headers?: Record<string, string> } = {}) {
  const headers = new Headers({
    'content-type': 'application/json',
    host: 'localhost:3000',
    origin: 'http://localhost:3000',
    ...options.headers,
  });

  return new NextRequest('http://localhost:3000/api/orders', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set NODE_ENV to test for CSRF bypass in testing
    vi.stubEnv('NODE_ENV', 'test');
  });

  describe('Successful submission', () => {
    it('should return 201 with order data on valid submission', async () => {
      const body = createValidBody();
      const request = createRequest(body);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.orderId).toBe('order-123');
      expect(data.data.state).toBe('Inquiry');
    });

    it('should call createOrderIntent with correct data', async () => {
      const { createOrderIntent } = await import('@/services/order.service');
      const body = createValidBody();
      const request = createRequest(body);

      await POST(request);

      expect(createOrderIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          servings: 50,
          flavorPreference: 'Vanilla',
          designDescription: 'A beautiful white cake with gold accents',
          budgetRange: '$200 – $350',
          customerName: 'Jane Doe',
          customerEmail: 'jane@example.com',
          customerPhone: '5125551234',
        })
      );
    });
  });

  describe('Validation errors', () => {
    it('should return 400 with field errors when required fields are missing', async () => {
      const request = createRequest({});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_FAILED');
      expect(data.error.fields).toBeDefined();
      expect(data.error.fields.length).toBeGreaterThan(0);

      const fieldNames = data.error.fields.map((f: { field: string }) => f.field);
      expect(fieldNames).toContain('eventDate');
      expect(fieldNames).toContain('servings');
      expect(fieldNames).toContain('flavor');
      expect(fieldNames).toContain('designDescription');
      expect(fieldNames).toContain('budgetRange');
      expect(fieldNames).toContain('name');
      expect(fieldNames).toContain('email');
      expect(fieldNames).toContain('phone');
    });

    it('should reject date less than 7 days from today', async () => {
      const body = createValidBody();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 3);
      body.eventDate = tomorrow.toISOString().split('T')[0];

      const request = createRequest(body);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      const dateError = data.error.fields.find((f: { field: string }) => f.field === 'eventDate');
      expect(dateError).toBeDefined();
      expect(dateError.reason).toContain('7 days');
    });

    it('should reject servings below minimum', async () => {
      const body = createValidBody();
      body.servings = '5';

      const request = createRequest(body);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      const servingsError = data.error.fields.find((f: { field: string }) => f.field === 'servings');
      expect(servingsError).toBeDefined();
      expect(servingsError.reason).toContain('10');
    });

    it('should reject servings above maximum', async () => {
      const body = createValidBody();
      body.servings = '600';

      const request = createRequest(body);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      const servingsError = data.error.fields.find((f: { field: string }) => f.field === 'servings');
      expect(servingsError).toBeDefined();
      expect(servingsError.reason).toContain('500');
    });

    it('should reject name exceeding max length', async () => {
      const body = createValidBody();
      body.name = 'a'.repeat(101);

      const request = createRequest(body);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      const nameError = data.error.fields.find((f: { field: string }) => f.field === 'name');
      expect(nameError).toBeDefined();
      expect(nameError.reason).toContain('100');
    });

    it('should reject invalid email format', async () => {
      const body = createValidBody();
      body.email = 'not-an-email';

      const request = createRequest(body);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      const emailError = data.error.fields.find((f: { field: string }) => f.field === 'email');
      expect(emailError).toBeDefined();
      expect(emailError.reason).toContain('valid email');
    });

    it('should reject phone with non-digit characters', async () => {
      const body = createValidBody();
      body.phone = '512-555-1234';

      const request = createRequest(body);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      const phoneError = data.error.fields.find((f: { field: string }) => f.field === 'phone');
      expect(phoneError).toBeDefined();
      expect(phoneError.reason).toContain('digits');
    });

    it('should reject design description with script tags', async () => {
      const body = createValidBody();
      body.designDescription = 'A cake with <script>alert("xss")</script>';

      const request = createRequest(body);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      const descError = data.error.fields.find(
        (f: { field: string }) => f.field === 'designDescription'
      );
      expect(descError).toBeDefined();
      expect(descError.reason).toContain('Invalid characters');
    });

    it('should reject invalid budget range', async () => {
      const body = createValidBody();
      body.budgetRange = '$999 – $1000';

      const request = createRequest(body);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      const budgetError = data.error.fields.find(
        (f: { field: string }) => f.field === 'budgetRange'
      );
      expect(budgetError).toBeDefined();
    });
  });

  describe('Error response format', () => {
    it('should not expose internal system details on server errors', async () => {
      const { createOrderIntent } = await import('@/services/order.service');
      (createOrderIntent as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Database connection failed: host=db.prod.internal password=xxx')
      );

      const body = createValidBody();
      const request = createRequest(body);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.code).toBe('INTERNAL_ERROR');
      expect(data.error.message).not.toContain('Database');
      expect(data.error.message).not.toContain('password');
      expect(data.error.message).not.toContain('internal');
    });

    it('should return 400 for invalid JSON body', async () => {
      const headers = new Headers({
        'content-type': 'application/json',
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
      });

      const request = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers,
        body: 'not json {{{',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_FAILED');
      expect(data.error.message).toBe('Invalid request body');
    });
  });

  describe('CSRF protection', () => {
    it('should reject requests without application/json content-type in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');

      const headers = new Headers({
        'content-type': 'text/plain',
        host: 'lalasweett.com',
        origin: 'http://lalasweett.com',
      });

      const body = createValidBody();
      const request = new NextRequest('http://lalasweett.com/api/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject requests with mismatched origin in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');

      const headers = new Headers({
        'content-type': 'application/json',
        host: 'lalasweett.com',
        origin: 'http://evil-site.com',
      });

      const body = createValidBody();
      const request = new NextRequest('http://lalasweett.com/api/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('should accept requests with matching origin', async () => {
      vi.stubEnv('NODE_ENV', 'production');

      const headers = new Headers({
        'content-type': 'application/json',
        host: 'lalasweett.com',
        origin: 'http://lalasweett.com',
      });

      const body = createValidBody();
      const request = new NextRequest('http://lalasweett.com/api/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });
  });
});
