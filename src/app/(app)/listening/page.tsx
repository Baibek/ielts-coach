import { ObjectiveHub, ObjectiveSession, sessionConfig } from "@/components/tests/objective-pages";

export const maxDuration = 60;

export default async function Page({ searchParams }: PageProps<"/listening">) {
  const config = sessionConfig("listening", await searchParams);
  return config ? <ObjectiveSession skill="listening" config={config} /> : <ObjectiveHub skill="listening" />;
}
