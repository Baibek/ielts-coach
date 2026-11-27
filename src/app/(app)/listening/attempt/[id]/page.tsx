import { ObjectiveReview } from "@/components/tests/objective-review";

export default async function Page({ params }: PageProps<"/listening/attempt/[id]">) {
  const { id } = await params;
  return <ObjectiveReview skill="listening" id={id} />;
}
