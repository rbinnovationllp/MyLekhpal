import { requireChatGPTUser } from '@/app/chatgpt-auth';
import Workspace from './workspace';
export const dynamic='force-dynamic';
export default async function Page(){const user=await requireChatGPTUser('/workspace');return <Workspace user={user.displayName}/>;}
