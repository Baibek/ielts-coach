import { ObjectiveReview } from "@/components/tests/objective-review";

export default async function Page({ params }: PageProps<"/reading/attempt/[id]">) {
  const { id } = await params;
  return <ObjectiveReview skill="reading" id={id} />;
}
