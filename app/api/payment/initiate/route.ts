import { POST as initPostHandler, GET as initGetHandler } from "../init/route";

// /api/payment/initiate rotasını /api/payment/init ile aynı işleyicilere yönlendir
export const POST = initPostHandler;
export const GET = initGetHandler;
