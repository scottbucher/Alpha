export abstract class MathUtils {
    public static clamp(input: number, min: number, max: number) {
        return Math.min(Math.max(input, min), max);
    }
}