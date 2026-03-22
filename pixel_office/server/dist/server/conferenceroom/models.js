export function generateRoomId() {
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const randomPart = Math.random().toString(36).substring(2, 10);
    return `conf-${dateStr}-${randomPart}`;
}
export function generateEventId() {
    return `evt-${Math.random().toString(36).substring(2, 10)}`;
}
export function getCurrentUtc() {
    return new Date().toISOString();
}
