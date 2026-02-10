interface LoginAttempt {
    count: number;
    lastAttempt: number;
}

export class AuthSecurityService {
    private attempts = new Map<string, LoginAttempt>();
    private readonly MAX_ATTEMPTS = 5;
    private readonly LOCK_TIME = 15 * 60 * 1000; // 15 minutes

    public canAttempt(username: string): boolean {
        const attempt = this.attempts.get(username);
        if (!attempt) return true;

        if (attempt.count >= this.MAX_ATTEMPTS) {
            const now = Date.now();
            if (now - attempt.lastAttempt < this.LOCK_TIME) {
                return false;
            } else {
                // Reset after lock period
                this.attempts.delete(username);
                return true;
            }
        }
        return true;
    }

    public recordFailure(username: string) {
        const attempt = this.attempts.get(username) || { count: 0, lastAttempt: 0 };
        attempt.count++;
        attempt.lastAttempt = Date.now();
        this.attempts.set(username, attempt);
    }

    public recordSuccess(username: string) {
        this.attempts.delete(username);
    }

    public validateCredentials(username: string, password: string): { valid: boolean; error?: string } {
        if (!username || username.length < 3 || username.length > 20) {
            return { valid: false, error: 'O usuário deve ter entre 3 e 20 caracteres.' };
        }
        if (!password || password.length < 6) {
            return { valid: false, error: 'A senha deve ter no mínimo 6 caracteres.' };
        }
        return { valid: true };
    }
}

export const authSecurityService = new AuthSecurityService();
