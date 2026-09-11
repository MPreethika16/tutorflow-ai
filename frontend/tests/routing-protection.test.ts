import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSafeRedirectUrl,
  evaluateProtectedAccess,
  type AuthResult,
  type AuthUser,
} from '@/lib/auth';

const mockTeacherUser: AuthUser = {
  id: 'usr_teach_1',
  firstName: 'Eleanor',
  lastName: 'Vane',
  email: 'el.vane@oxford.edu',
  role: 'TEACHER',
  status: 'ACTIVE',
};

const mockStudentUser: AuthUser = {
  id: 'usr_stud_1',
  firstName: 'Arthur',
  lastName: 'Pendleton',
  email: null,
  role: 'STUDENT',
  status: 'ACTIVE',
};

describe('Role-Aware Routing & Shell Protection', () => {
  describe('safe post-login role routing', () => {
    it('routes teacher to /teacher/assessments by default when returnUrl is omitted', () => {
      assert.equal(getSafeRedirectUrl(undefined, 'TEACHER'), '/teacher/assessments');
      assert.equal(getSafeRedirectUrl(null, 'TEACHER'), '/teacher/assessments');
      assert.equal(getSafeRedirectUrl('', 'TEACHER'), '/teacher/assessments');
    });

    it('routes student to /student by default when returnUrl is omitted', () => {
      assert.equal(getSafeRedirectUrl(undefined, 'STUDENT'), '/student');
      assert.equal(getSafeRedirectUrl(null, 'STUDENT'), '/student');
      assert.equal(getSafeRedirectUrl('', 'STUDENT'), '/student');
    });

    it('preserves valid teacher relative destinations including search and hash', () => {
      const destination = '/teacher/assessments/asmt_123?sort=date#submissions';
      assert.equal(getSafeRedirectUrl(destination, 'TEACHER'), destination);
    });

    it('preserves valid student relative destinations including query parameters', () => {
      const destination = '/student/attempts/att_987/result?tab=feedback';
      assert.equal(getSafeRedirectUrl(destination, 'STUDENT'), destination);
    });
  });

  describe('malicious and external redirect rejection (open redirect prevention)', () => {
    it('rejects absolute http and https URLs', () => {
      assert.equal(getSafeRedirectUrl('https://evil.com/steal-creds', 'TEACHER'), '/teacher/assessments');
      assert.equal(getSafeRedirectUrl('http://attacker.org/login', 'STUDENT'), '/student');
    });

    it('rejects protocol-relative URLs (//evil.com)', () => {
      assert.equal(getSafeRedirectUrl('//evil.com/teacher/assessments', 'TEACHER'), '/teacher/assessments');
      assert.equal(getSafeRedirectUrl('//evil.com/student', 'STUDENT'), '/student');
    });

    it('rejects backslash-based evasion (/\\evil.com)', () => {
      assert.equal(getSafeRedirectUrl('/\\evil.com', 'TEACHER'), '/teacher/assessments');
      assert.equal(getSafeRedirectUrl('\\evil.com', 'STUDENT'), '/student');
    });

    it('rejects javascript: and data: pseudo-protocols', () => {
      assert.equal(getSafeRedirectUrl('javascript:alert(1)', 'TEACHER'), '/teacher/assessments');
      assert.equal(getSafeRedirectUrl('data:text/html,<script>evil()</script>', 'STUDENT'), '/student');
    });

    it('rejects external host even if containing localhost', () => {
      assert.equal(getSafeRedirectUrl('http://localhost:3000/teacher/assessments', 'TEACHER'), '/teacher/assessments');
    });
  });

  describe('unauthenticated protected route decision', () => {
    it('redirects unauthenticated teacher route requests to login with encoded returnUrl', () => {
      const unauth: AuthResult = { status: 'unauthenticated' };
      const decision = evaluateProtectedAccess(unauth, 'TEACHER', '/teacher/assessments/asmt_456');

      assert.equal(decision.action, 'redirect');
      if (decision.action === 'redirect') {
        assert.equal(
          decision.destination,
          '/login?returnUrl=%2Fteacher%2Fassessments%2Fasmt_456',
        );
      }
    });

    it('redirects unauthenticated student route requests to login with encoded returnUrl', () => {
      const unauth: AuthResult = { status: 'unauthenticated' };
      const decision = evaluateProtectedAccess(unauth, 'STUDENT', '/student');

      assert.equal(decision.action, 'redirect');
      if (decision.action === 'redirect') {
        assert.equal(decision.destination, '/login?returnUrl=%2Fstudent');
      }
    });
  });

  describe('cross-role boundary enforcement', () => {
    it('blocks teacher from student shell and redirects to /teacher/assessments', () => {
      const teacherAuth: AuthResult = {
        status: 'authenticated',
        user: mockTeacherUser,
      };
      const decision = evaluateProtectedAccess(teacherAuth, 'STUDENT', '/student');

      assert.equal(decision.action, 'redirect');
      if (decision.action === 'redirect') {
        assert.equal(decision.destination, '/teacher/assessments');
      }
    });

    it('blocks teacher from student redirect targets in post-login routing', () => {
      assert.equal(
        getSafeRedirectUrl('/student', 'TEACHER'),
        '/teacher/assessments',
      );
      assert.equal(
        getSafeRedirectUrl('/student/attempts/123', 'TEACHER'),
        '/teacher/assessments',
      );
    });

    it('blocks student from teacher shell and redirects to /student', () => {
      const studentAuth: AuthResult = {
        status: 'authenticated',
        user: mockStudentUser,
      };
      const decision = evaluateProtectedAccess(studentAuth, 'TEACHER', '/teacher/assessments');

      assert.equal(decision.action, 'redirect');
      if (decision.action === 'redirect') {
        assert.equal(decision.destination, '/student');
      }
    });

    it('blocks student from teacher redirect targets in post-login routing', () => {
      assert.equal(
        getSafeRedirectUrl('/teacher/assessments', 'STUDENT'),
        '/student',
      );
      assert.equal(
        getSafeRedirectUrl('/teacher/assessments/456', 'STUDENT'),
        '/student',
      );
    });
  });

  describe('auth-service-error distinction', () => {
    it('renders service_unavailable on network failure rather than redirecting to login', () => {
      const networkError: AuthResult = {
        status: 'error',
        error: 'NETWORK_ERROR',
        message: 'fetch failed: ECONNREFUSED',
      };
      const decision = evaluateProtectedAccess(networkError, 'TEACHER', '/teacher/assessments');

      assert.equal(decision.action, 'service_unavailable');
      if (decision.action === 'service_unavailable') {
        assert.equal(decision.error, 'NETWORK_ERROR');
      }
    });

    it('renders service_unavailable on 5xx backend server error rather than pretending unauthenticated', () => {
      const serverError: AuthResult = {
        status: 'error',
        error: 'SERVER_ERROR',
        statusCode: 503,
        message: 'Backend returned HTTP 503',
      };
      const decision = evaluateProtectedAccess(serverError, 'STUDENT', '/student');

      assert.equal(decision.action, 'service_unavailable');
      if (decision.action === 'service_unavailable') {
        assert.equal(decision.error, 'SERVER_ERROR');
      }
    });
  });

  describe('authorized access resolution', () => {
    it('allows teacher access to teacher shell', () => {
      const teacherAuth: AuthResult = {
        status: 'authenticated',
        user: mockTeacherUser,
      };
      const decision = evaluateProtectedAccess(teacherAuth, 'TEACHER', '/teacher/assessments');

      assert.equal(decision.action, 'allow');
      if (decision.action === 'allow') {
        assert.equal(decision.user.id, mockTeacherUser.id);
      }
    });

    it('allows student access to student shell when mustChangePassword is false or undefined', () => {
      const studentAuth: AuthResult = {
        status: 'authenticated',
        user: { ...mockStudentUser, mustChangePassword: false },
      };
      const decision = evaluateProtectedAccess(studentAuth, 'STUDENT', '/student');

      assert.equal(decision.action, 'allow');
      if (decision.action === 'allow') {
        assert.equal(decision.user.id, mockStudentUser.id);
      }
    });

    it('redirects student with mustChangePassword true to /change-password', () => {
      const studentAuth: AuthResult = {
        status: 'authenticated',
        user: { ...mockStudentUser, mustChangePassword: true },
      };
      const decision = evaluateProtectedAccess(studentAuth, 'STUDENT', '/student');

      assert.equal(decision.action, 'redirect');
      if (decision.action === 'redirect') {
        assert.equal(decision.destination, '/change-password');
      }
    });

    it('teacher is unaffected by mustChangePassword check and allowed to teacher shell', () => {
      const teacherAuth: AuthResult = {
        status: 'authenticated',
        user: { ...mockTeacherUser, mustChangePassword: false },
      };
      const decision = evaluateProtectedAccess(teacherAuth, 'TEACHER', '/teacher/assessments');

      assert.equal(decision.action, 'allow');
      if (decision.action === 'allow') {
        assert.equal(decision.user.id, mockTeacherUser.id);
      }
    });
  });
});
