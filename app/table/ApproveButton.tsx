export default function ApproveButton({ threadId }: { threadId: string }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#07050e] via-[#07050e] to-transparent flex justify-center">
      <form method="POST" action="/api/approve" className="w-full max-w-md">
        <input type="hidden" name="threadId" value={threadId} />
        <button
          type="submit"
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-extrabold rounded-xl shadow-lg transition-all duration-150 active:scale-[0.98]"
        >
          Approve & Push to Notion
        </button>
      </form>
    </div>
  );
}
