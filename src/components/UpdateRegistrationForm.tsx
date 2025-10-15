import React, { useState } from 'react';
import { LoadingOverlay } from './LoadingOverlay';
import { FormInput, Button } from './Form';
import { syncManager } from '../lib/syncManager';

interface UpdateFormProps {
  eventId: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export const UpdateRegistrationForm: React.FC<UpdateFormProps> = ({
  eventId,
  onSuccess,
  onError
}) => {
  const [loading, setLoading] = useState(false);
  const [regCode, setRegCode] = useState('');
  const [formData, setFormData] = useState({
    team_name: '',
    email: '',
    college_name: '',
    contact_number: '',
    team_size: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await syncManager.updateRegistrationByCode(eventId, regCode, {
        ...formData,
        team_size: parseInt(formData.team_size) || 1
      });
      onSuccess?.();
      // Reset form
      setFormData({
        team_name: '',
        email: '',
        college_name: '',
        contact_number: '',
        team_size: ''
      });
      setRegCode('');
    } catch (error) {
      console.error('Failed to update registration:', error);
      onError?.(error as Error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          name="reg_code"
          placeholder="Registration Code"
          value={regCode}
          onChange={(e) => setRegCode(e.target.value)}
          required
        />
        <FormInput
          name="team_name"
          placeholder="Team Name"
          value={formData.team_name}
          onChange={handleChange}
          required
        />
        <FormInput
          name="email"
          type="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
        />
        <FormInput
          name="college_name"
          placeholder="College Name"
          value={formData.college_name}
          onChange={handleChange}
          required
        />
        <FormInput
          name="contact_number"
          placeholder="Contact Number"
          value={formData.contact_number}
          onChange={handleChange}
          required
        />
        <FormInput
          name="team_size"
          type="number"
          placeholder="Team Size"
          value={formData.team_size}
          onChange={handleChange}
          min="1"
          required
        />
        <Button type="submit" disabled={loading}>
          Update Registration
        </Button>
      </form>

      <LoadingOverlay 
        isLoading={loading}
        message="Updating registration..."
      />
    </div>
  );
};