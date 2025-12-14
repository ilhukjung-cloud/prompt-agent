import React, { useState, useRef } from 'react';

const FileUpload = ({ onFileAnalyzed, disabled }) => {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);

  const allowedTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'text/plain',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ];

  const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.txt', '.md', '.docx', '.pptx'];

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    handleFiles(selectedFiles);
  };

  const handleFiles = async (newFiles) => {
    const validFiles = newFiles.filter((file) => {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      return allowedTypes.includes(file.type) || allowedExtensions.includes(ext);
    });

    if (validFiles.length === 0) {
      alert('지원하지 않는 파일 형식입니다.\n지원 형식: PDF, 이미지(PNG, JPG, WEBP, GIF), 텍스트(TXT, MD), Office(DOCX, PPTX)');
      return;
    }

    setFiles((prev) => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const processFiles = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);

    try {
      const fileDataArray = await Promise.all(
        files.map(async (file) => {
          const base64 = await fileToBase64(file);
          return {
            name: file.name,
            type: file.type,
            size: file.size,
            base64Data: base64.split(',')[1], // Remove data:xxx;base64, prefix
            mimeType: file.type || getMimeType(file.name),
          };
        })
      );

      onFileAnalyzed(fileDataArray);
      setFiles([]);
    } catch (error) {
      console.error('File processing error:', error);
      alert('파일 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const getMimeType = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const mimeTypes = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
      txt: 'text/plain',
      md: 'text/markdown',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
      pdf: '📄',
      png: '🖼️',
      jpg: '🖼️',
      jpeg: '🖼️',
      webp: '🖼️',
      gif: '🖼️',
      txt: '📝',
      md: '📝',
      docx: '📘',
      pptx: '📊',
    };
    return icons[ext] || '📎';
  };

  return (
    <div className="file-upload">
      <div
        className={`drop-zone ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          multiple
          accept={allowedExtensions.join(',')}
          style={{ display: 'none' }}
          disabled={disabled}
        />
        <div className="drop-zone-content">
          <span className="upload-icon">📁</span>
          <p className="drop-zone-text">
            기존 보고서나 참고 자료를 여기에 드래그하거나 클릭하세요
          </p>
          <p className="drop-zone-hint">
            PDF, 이미지, 텍스트, PPT 파일 지원 (최대 20MB)
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="file-list">
          <div className="file-list-header">
            <span>첨부된 파일 ({files.length})</span>
            <button
              className="analyze-btn"
              onClick={processFiles}
              disabled={isProcessing || disabled}
            >
              {isProcessing ? '처리 중...' : '파일 분석 시작'}
            </button>
          </div>
          <ul>
            {files.map((file, index) => (
              <li key={index} className="file-item">
                <span className="file-icon">{getFileIcon(file.name)}</span>
                <span className="file-name">{file.name}</span>
                <span className="file-size">{formatFileSize(file.size)}</span>
                <button
                  className="remove-file-btn"
                  onClick={() => removeFile(index)}
                  disabled={isProcessing}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
