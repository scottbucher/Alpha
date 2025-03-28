import { customAlphabet } from 'nanoid';

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const NUMBERS = '0123456789';
export class RandomUtils {
    private static nanoid = customAlphabet(LOWERCASE + NUMBERS);

    public static intFromInterval(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    public static shuffle(input: any[]): any[] {
        for (let i = input.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [input[i], input[j]] = [input[j], input[i]];
        }
        return input;
    }

    public static friendlyId(size: number): string {
        return this.nanoid(size);
    }
}
