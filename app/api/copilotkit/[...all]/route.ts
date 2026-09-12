import { MastraAgent } from "@ag-ui/mastra";
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import { RequestContext } from "@mastra/core/request-context";
import { auth } from "@/lib/auth";
import { USER_ID_KEY } from "@/lib/todos";
import { mastra, TUTOR_AGENT_ID } from "@/lib/tutor";

const basePath = "/api/copilotkit";

async function handler(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // The whole isolation story: `resourceId` is the verified user id and is
  // never read from the request, so the memory Mastra loads and writes belongs
  // to the caller by construction. Built per request, hence the runtime is too.
  //
  // The same id rides the RequestContext, which is where the to-do tools read
  // it from. MastraAgent files client-supplied context under its own "ag-ui"
  // key, so neither the browser nor the model can overwrite this one.
  const requestContext = new RequestContext();
  requestContext.set(USER_ID_KEY, session.user.id);

  const agent = MastraAgent.getLocalAgent({
    mastra,
    agentId: TUTOR_AGENT_ID,
    resourceId: session.user.id,
    requestContext,
  });

  const runtime = new CopilotRuntime({
    agents: { [TUTOR_AGENT_ID]: agent },
  });

  return createCopilotRuntimeHandler({ runtime, basePath })(request);
}

export const GET = handler;
export const POST = handler;
