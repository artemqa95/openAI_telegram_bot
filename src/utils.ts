export const parseError = (e: unknown, enableStackTrace?: boolean) => {
  if (typeof e === "string") {
    return e;
  }
  if (e instanceof Error) {
    const stack = enableStackTrace ? "\n" + e.stack : "";

    return e.message + stack;
  }

  return JSON.stringify(e);
};