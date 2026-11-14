class Clock {
  now(): number {
    return 1;
  }
}

const clock = new Clock();

export const read = clock.now;
