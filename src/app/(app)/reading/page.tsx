import { ObjectiveHub, ObjectiveSession, sessionConfig } from "@/components/tests/objective-pages";

export const maxDuration = 60;

export default async function Page({ searchParams }: PageProps<"/reading">) {
  const config = sessionConfig("reading", await searchParams);
  return config ? <ObjectiveSession skill="reading" config={config} /> : <ObjectiveHub skill="reading" />;
}
