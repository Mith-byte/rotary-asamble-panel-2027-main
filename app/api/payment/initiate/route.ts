import { POST as initHandler } from "../init/route";

// /api/payment/initiate rotasını /api/payment/init ile aynı işleyiciye yönlendir
export const POST = initHandler;
