import { DAY_DURATION } from "../utils";

export const MAX_DAYS = 5550;
export const MAX_DURATION = MAX_DAYS * 1 * DAY_DURATION;
export const MAX_COLLECTION = 333 * DAY_DURATION;
export const MIN_COLLECTION = 3 * DAY_DURATION;
export const TIME_DILATION = 3;

export function calculatePenalty(amount: number, duration: number, time: number): number {
    if (amount == 0) return 0;
    if (duration == 0) return 0;
    if (time == 0) return amount;

    if (time < duration) {
        return calculateEarlyPenalty(amount, duration, time);
    }

    const expires = duration + calculateCollectionWindow(duration);

    if (time > expires) {
        return calculateLatePenalty(amount, duration, time - expires);
    }

    return 0;
}

export function calculateInterest(rate: number, amount: number, duration: number, time: number): number {
    if (time == 0) return 0;
    if (amount == 0) return 0;
    if (duration == 0) return 0;

    if (time < duration) {
        return calculateEarlyInterest(rate, amount, duration, time);
    }

    const expires = duration + calculateCollectionWindow(duration);

    if (time > expires) {
        return calculateLateInterest(rate, amount, duration, time - expires);
    }

    return calculateMaximumInterest(rate, amount, duration, duration);
}

export function calculateCollectionWindow(duration: number): number {
    const window = duration / TIME_DILATION;
    if (window < MIN_COLLECTION) return MIN_COLLECTION;
    if (window > MAX_COLLECTION) return MAX_COLLECTION;
    return window;
}

function calculateMaximumInterest(rate: number, amount: number, duration: number, time: number): number {
    let payment = amount;

    payment = (payment * time) / MAX_DURATION;
    payment = (((payment * 25) / 2) * rate) / 10000;

    let bonus = (payment * duration) / MAX_DURATION;
    bonus = (bonus * 33333) / 10000;

    return payment + bonus;
}

function calculateEarlyInterest(rate: number, amount: number, duration: number, time: number): number {
    const payment = calculateMaximumInterest(rate, amount, duration, time);
    return (payment * time) / duration;
}

function calculateLateInterest(rate: number, amount: number, duration: number, time: number): number {
    const total = duration / TIME_DILATION;
    if (total < time) return 0;

    const left = total - time;
    let payment = calculateMaximumInterest(rate, amount, total, left);

    payment = (payment * left) / total;
    payment = (payment * left) / total;

    return TIME_DILATION * payment;
}

function calculateEarlyPenalty(amount: number, duration: number, time: number): number {
    return amount - (amount * time) / duration;
}

function calculateLatePenalty(amount: number, duration: number, late: number): number {
    const penalty = (TIME_DILATION * amount * late) / duration;
    return penalty > amount ? amount : penalty;
}
