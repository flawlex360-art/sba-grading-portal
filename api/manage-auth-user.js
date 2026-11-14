import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const SENIOR_SUPER_USER_EMAIL = 'system@flawlex.com';

/**
 * Parses Firebase Admin service account credentials from environment variables.
 * Supports either `FIREBASE_SERVICE_ACCOUNT_JSON` (raw or base64 JSON) or split
 * `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` + `FIREBASE_PROJECT_ID`.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ projectId: string, clientEmail: string, privateKey: string }|null}
 */
export function parseServiceAccountFromEnv(env = process.env) {
  const rawJson = String(
    env.FIREBASE_SERVICE_ACCOUNT_JSON || env.GOOGLE_APPLICATION_CREDENTIALS_JSON || ''
  ).trim();

  if (rawJson) {
    const candidates = [rawJson];
    if (!rawJson.startsWith('{')) {
      try {
        candidates.push(Buffer.from(rawJson, 'base64').toString('utf8').trim());
      } catch {
        // Ignore invalid base64
      }
    }

    for (const candidate of candidates) {
      if (!candidate.startsWith('{')) continue;
      try {
        const parsed = JSON.parse(candidate);
        const projectId = String(parsed.project_id || parsed.projectId || '').trim();
        const clientEmail = String(parsed.client_email || parsed.clientEmail || '').trim();
        const privateKey = String(parsed.private_key || parsed.privateKey || '')
          .replace(/\\n/g, '\n')
          .trim();
        if (projectId && clientEmail && privateKey) {
          return { projectId, clientEmail, privateKey };
        }
      } catch {
        // Try next candidate
      }
    }
  }

  const projectId = String(
    env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || ''
  ).trim();
  const clientEmail = String(env.FIREBASE_CLIENT_EMAIL || '').trim();
  const privateKey = String(env.FIREBASE_PRIVATE_KEY || '')
    .replace(/\\n/g, '\n')
    .trim();

  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  return null;
}

let cachedServices = null;

function defaultGetAdminServices() {
  if (cachedServices) return cachedServices;

  const serviceAccount = parseServiceAccountFromEnv(process.env);
  if (!serviceAccount) {
    return null;
  }

  const existingApp = getApps().find((a) => a.name === 'admin-auth-manager');
  const adminApp =
    existingApp ||
    initializeApp(
      {
        credential: cert(serviceAccount),
        projectId: serviceAccount.projectId,
      },
      'admin-auth-manager'
    );

  cachedServices = {
    authAdmin: getAuth(adminApp),
    dbAdmin: getFirestore(adminApp),
  };
  return cachedServices;
}

function getBearerToken(req) {
  const authHeader =
    req?.headers?.authorization || req?.headers?.Authorization || '';
  const match = String(authHeader).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

function isValidEmailFormat(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function resolveCallerAuthority({ idToken, authAdmin, dbAdmin }) {
  const decoded = await authAdmin.verifyIdToken(idToken, true);
  const callerUid = String(decoded.uid || '').trim();
  const callerEmail = normalizeEmail(decoded.email);

  if (callerEmail === SENIOR_SUPER_USER_EMAIL) {
    return {
      role: 'senior_super_user',
      uid: callerUid,
      email: callerEmail,
      institutionId: null,
    };
  }

  const callerTeacherSnap = callerUid
    ? await dbAdmin.collection('teachers').doc(callerUid).get()
    : null;
  const callerTeacherData = callerTeacherSnap?.exists ? callerTeacherSnap.data() : null;

  if (callerTeacherData?.isSeniorSuperUser === true) {
    return {
      role: 'senior_super_user',
      uid: callerUid,
      email: callerEmail,
      institutionId: null,
    };
  }

  if (callerTeacherData?.isAdmin === true && callerTeacherData?.institutionId) {
    return {
      role: 'super_admin',
      uid: callerUid,
      email: callerEmail,
      institutionId: String(callerTeacherData.institutionId).trim(),
    };
  }

  if (callerEmail) {
    const instSnap = await dbAdmin
      .collection('institutions')
      .where('adminEmail', '==', callerEmail)
      .limit(1)
      .get();
    if (!instSnap.empty) {
      return {
        role: 'super_admin',
        uid: callerUid,
        email: callerEmail,
        institutionId: instSnap.docs[0].id,
      };
    }
  }

  const err = new Error('Forbidden: Administrator privileges are required.');
  err.statusCode = 403;
  err.code = 'FORBIDDEN';
  throw err;
}

async function isEmailOrphanedInFirestore({ dbAdmin, email, existingUid }) {
  const cleanEmail = normalizeEmail(email);
  const [teachersByEmail, instByEmail, teacherByUidSnap] = await Promise.all([
    dbAdmin.collection('teachers').where('email', '==', cleanEmail).limit(1).get(),
    dbAdmin.collection('institutions').where('adminEmail', '==', cleanEmail).limit(1).get(),
    existingUid ? dbAdmin.collection('teachers').doc(existingUid).get() : Promise.resolve(null),
  ]);

  if (!teachersByEmail.empty || !instByEmail.empty) {
    return false;
  }
  if (teacherByUidSnap?.exists) {
    return false;
  }
  return true;
}

/**
 * Factory creating the `/api/manage-auth-user` handler (injectable for tests).
 */
export function createManageAuthUserHandler({ getServices = defaultGetAdminServices } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') {
      return res.status(204).json({ ok: true });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method Not Allowed. Use POST.' });
    }

    const services = getServices();
    if (!services?.authAdmin || !services?.dbAdmin) {
      return res.status(503).json({
        ok: false,
        code: 'SERVICE_NOT_CONFIGURED',
        error:
          'Firebase Admin SDK is not configured on the server yet. Add FIREBASE_SERVICE_ACCOUNT_JSON in Vercel environment variables.',
      });
    }

    const idToken = getBearerToken(req);
    if (!idToken) {
      return res.status(401).json({ ok: false, code: 'UNAUTHORIZED', error: 'Missing Authorization Bearer token.' });
    }

    let caller;
    try {
      caller = await resolveCallerAuthority({
        idToken,
        authAdmin: services.authAdmin,
        dbAdmin: services.dbAdmin,
      });
    } catch (authErr) {
      const code = authErr?.statusCode || (authErr?.code?.startsWith('auth/') ? 401 : 403);
      return res.status(code).json({
        ok: false,
        code: authErr?.code || 'UNAUTHORIZED',
        error: authErr?.message || 'Unauthorized request.',
      });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const action = String(body.action || '').trim().toLowerCase();

    try {
      if (action === 'create') {
        const cleanEmail = normalizeEmail(body.email);
        const password = String(body.password || '');
        const displayName = String(body.displayName || '').trim();
        const requestedInstId = String(body.institutionId || '').trim();

        if (!isValidEmailFormat(cleanEmail)) {
          return res.status(400).json({ ok: false, error: 'Please provide a valid email address.' });
        }
        if (cleanEmail === SENIOR_SUPER_USER_EMAIL) {
          return res.status(403).json({ ok: false, error: 'Cannot create or overwrite system super account.' });
        }
        if (password.length < 6) {
          return res.status(400).json({
            ok: false,
            code: 'auth/weak-password',
            error: 'Password must be at least 6 characters long.',
          });
        }
        if (
          caller.role === 'super_admin' &&
          requestedInstId &&
          requestedInstId !== caller.institutionId
        ) {
          return res.status(403).json({
            ok: false,
            code: 'FORBIDDEN',
            error: 'Cannot manage users outside your institution.',
          });
        }

        try {
          const created = await services.authAdmin.createUser({
            email: cleanEmail,
            password,
            ...(displayName ? { displayName } : {}),
          });
          return res.status(200).json({
            ok: true,
            uid: created.uid,
            email: cleanEmail,
            reclaimedOrphan: false,
          });
        } catch (createErr) {
          if (createErr?.code !== 'auth/email-already-exists') {
            throw createErr;
          }

          const existingAuth = await services.authAdmin.getUserByEmail(cleanEmail);
          const orphaned = await isEmailOrphanedInFirestore({
            dbAdmin: services.dbAdmin,
            email: cleanEmail,
            existingUid: existingAuth.uid,
          });

          if (!orphaned) {
            return res.status(409).json({
              ok: false,
              code: 'auth/email-already-in-use',
              error: 'This email address is already registered to an active account.',
            });
          }

          // Orphaned Auth user (no active profile in Firestore) — purge cleanly and recreate with the new password
          await services.authAdmin.deleteUser(existingAuth.uid);
          const recreated = await services.authAdmin.createUser({
            email: cleanEmail,
            password,
            ...(displayName ? { displayName } : {}),
          });
          return res.status(200).json({
            ok: true,
            uid: recreated.uid,
            email: cleanEmail,
            reclaimedOrphan: true,
            purgedOrphanUid: existingAuth.uid,
          });
        }
      }

      if (action === 'delete') {
        const targetUid = String(body.targetUid || body.uid || '').trim();
        const targetEmail = normalizeEmail(body.email);

        if (!targetUid && !targetEmail) {
          return res.status(400).json({ ok: false, error: 'targetUid or email is required.' });
        }
        if (targetUid && targetUid === caller.uid) {
          return res.status(400).json({ ok: false, error: 'You cannot delete your own active login account.' });
        }
        if (targetEmail === SENIOR_SUPER_USER_EMAIL) {
          return res.status(403).json({ ok: false, error: 'Cannot delete the Senior Super User account.' });
        }

        let resolvedTargetEmail = targetEmail;
        if (targetUid) {
          const targetSnap = await services.dbAdmin.collection('teachers').doc(targetUid).get();
          const targetData = targetSnap.exists ? targetSnap.data() : null;

          if (targetData?.isSeniorSuperUser === true || normalizeEmail(targetData?.email) === SENIOR_SUPER_USER_EMAIL) {
            return res.status(403).json({ ok: false, error: 'Cannot delete a Senior Super User account.' });
          }

          if (caller.role === 'super_admin') {
            if (!targetSnap.exists) {
              return res.status(404).json({
                ok: false,
                code: 'TARGET_NOT_FOUND',
                error: 'Teacher record not found in your institution.',
              });
            }
            if (String(targetData?.institutionId || '').trim() !== caller.institutionId) {
              return res.status(403).json({
                ok: false,
                code: 'FORBIDDEN',
                error: 'Cannot delete users belonging to another institution.',
              });
            }
            if (targetData?.isAdmin === true) {
              return res.status(403).json({
                ok: false,
                code: 'FORBIDDEN',
                error: 'School Administrators cannot delete administrator accounts.',
              });
            }
          }

          if (!resolvedTargetEmail && targetData?.email) {
            resolvedTargetEmail = normalizeEmail(targetData.email);
          }
        } else if (caller.role === 'super_admin') {
          return res.status(400).json({
            ok: false,
            error: 'targetUid is required when deleting a teacher account.',
          });
        }

        let deletedFromAuth = false;
        let resolvedDeletedUid = targetUid || null;

        if (targetUid) {
          try {
            await services.authAdmin.deleteUser(targetUid);
            deletedFromAuth = true;
          } catch (delErr) {
            if (delErr?.code !== 'auth/user-not-found') {
              throw delErr;
            }
          }
        }

        // Also ensure no Auth account remains under that email (handles UID drift edge cases)
        if (!deletedFromAuth && resolvedTargetEmail) {
          try {
            const byEmail = await services.authAdmin.getUserByEmail(resolvedTargetEmail);
            if (byEmail.uid !== caller.uid && normalizeEmail(byEmail.email) !== SENIOR_SUPER_USER_EMAIL) {
              await services.authAdmin.deleteUser(byEmail.uid);
              deletedFromAuth = true;
              resolvedDeletedUid = byEmail.uid;
            }
          } catch (lookupErr) {
            if (lookupErr?.code !== 'auth/user-not-found') {
              throw lookupErr;
            }
          }
        }

        return res.status(200).json({
          ok: true,
          deletedFromAuth,
          alreadyAbsent: !deletedFromAuth,
          uid: resolvedDeletedUid,
        });
      }

      if (action === 'reset-password') {
        const targetUid = String(body.targetUid || body.uid || '').trim();
        const newPassword = String(body.newPassword || body.password || '');

        if (!targetUid) {
          return res.status(400).json({ ok: false, error: 'targetUid is required.' });
        }
        if (newPassword.length < 6) {
          return res.status(400).json({
            ok: false,
            code: 'auth/weak-password',
            error: 'New password must be at least 6 characters long.',
          });
        }

        const targetSnap = await services.dbAdmin.collection('teachers').doc(targetUid).get();
        if (!targetSnap.exists) {
          return res.status(404).json({ ok: false, error: 'Teacher account not found.' });
        }
        const targetData = targetSnap.data();
        if (
          targetData?.isSeniorSuperUser === true ||
          normalizeEmail(targetData?.email) === SENIOR_SUPER_USER_EMAIL
        ) {
          return res.status(403).json({ ok: false, error: 'Cannot reset Senior Super User password via this endpoint.' });
        }
        if (caller.role === 'super_admin') {
          if (String(targetData?.institutionId || '').trim() !== caller.institutionId) {
            return res.status(403).json({ ok: false, error: 'Cannot reset passwords for another institution.' });
          }
          if (targetData?.isAdmin === true) {
            return res.status(403).json({ ok: false, error: 'Cannot reset administrator passwords here.' });
          }
        }

        await services.authAdmin.updateUser(targetUid, { password: newPassword });
        return res.status(200).json({ ok: true, uid: targetUid });
      }

      return res.status(400).json({
        ok: false,
        error: 'Unsupported action. Expected one of: create, delete, reset-password.',
      });
    } catch (err) {
      console.error('[manage-auth-user] Error:', err);
      const status =
        err?.code === 'auth/email-already-exists' || err?.code === 'auth/email-already-in-use'
          ? 409
          : err?.code === 'auth/invalid-password' || err?.code === 'auth/weak-password'
            ? 400
            : 500;
      return res.status(status).json({
        ok: false,
        code: err?.code || 'INTERNAL_ERROR',
        error: err?.message || 'Unexpected error managing authentication user.',
      });
    }
  };
}

export default createManageAuthUserHandler();
