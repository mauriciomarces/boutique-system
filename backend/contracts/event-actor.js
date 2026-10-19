function verifiedActorId(request) {
  const actor = request?.authenticatedUser;
  const value = actor?.id ?? actor?.usuario_id ?? actor?.user_id ?? actor?.sub;
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    !/^\d+$/.test(String(value))
  ) {
    return null;
  }
  const id = Number(value);
  return Number.isSafeInteger(id) && id >= 0 ? id : null;
}

module.exports = { verifiedActorId };
