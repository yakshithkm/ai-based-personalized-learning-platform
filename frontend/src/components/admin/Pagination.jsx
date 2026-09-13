const Pagination = ({ page, totalPages, total, onPageChange }) => {
  if (!totalPages || totalPages <= 1) return null;

  return (
    <div className="admin-pagination">
      <span className="admin-pagination-info">
        Page {page} of {totalPages} · {total} total
      </span>
      <div className="admin-pagination-controls">
        <button
          type="button"
          className="outline-btn outline-btn-sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="outline-btn outline-btn-sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default Pagination;