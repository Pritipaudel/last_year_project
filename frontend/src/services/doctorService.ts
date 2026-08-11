import { api } from "./api";

export interface DoctorProfile {
  id: number;
  name: string;
  specialty: string;
  rating: number;
  distance: string;
  distanceKm?: number;
  imageUrl: string; // Will map snake_case image_url
  bio: string;
  experience: number;
  hospital: string;
  address?: string;
  phone?: string;
  isAvailable: boolean;
  patientsCount: number;
  responseTime: string;
}

export interface AvailabilitySlot {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  formattedTime: string;
}

export interface Appointment {
  id: number;
  doctor: number;
  doctorDetail: DoctorProfile;
  slot: number | null;
  date: string;
  timeSlot: string;
  reason: string;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
}

export interface Message {
  id: number;
  sender: number;
  senderName: string;
  doctor: number;
  doctorName: string;
  content: string;
  timestamp: string;
  isFromDoctor: boolean;
}

// Map backend keys to frontend lowerCamelCase
const mapDoctor = (data: any): DoctorProfile => ({
  id: data.id,
  name: data.name,
  specialty: data.specialty,
  rating: Number(data.rating),
  distance: data.distance,
  distanceKm: data.distanceKm,
  imageUrl: data.image_url,
  bio: data.bio,
  experience: data.experience,
  hospital: data.hospital,
  address: data.address,
  phone: data.phone,
  isAvailable: data.is_available,
  patientsCount: data.patients_count,
  responseTime: data.response_time,
});

const mapAppt = (data: any): Appointment => ({
  id: data.id,
  doctor: data.doctor,
  doctorDetail: data.doctor_detail ? mapDoctor(data.doctor_detail) : data.doctor_detail,
  slot: data.slot,
  date: data.date,
  timeSlot: data.time_slot,
  reason: data.reason,
  status: data.status,
  createdAt: data.created_at,
});

const mapMessage = (data: any): Message => ({
  id: data.id,
  sender: data.sender,
  senderName: data.sender_name,
  doctor: data.doctor,
  doctorName: data.doctor_name,
  content: data.content,
  timestamp: data.timestamp,
  isFromDoctor: data.is_from_doctor,
});

export const doctorService = {
  async getDoctors(specialty?: string, search?: string): Promise<DoctorProfile[]> {
    const params: Record<string, string> = {};
    if (specialty && specialty !== "All") params.specialty = specialty;
    if (search) params.search = search;
    const response = await api.get("/doctors/", { params });
    return response.data.map(mapDoctor);
  },

  async getNearbyDoctors(lat: number, lng: number, limit: number = 10): Promise<DoctorProfile[]> {
    const response = await api.get("/doctors/nearby/", {
      params: { lat, lng, limit },
    });
    return response.data.map(mapDoctor);
  },

  async getDoctorDetail(id: string | number): Promise<DoctorProfile> {
    const response = await api.get(`/doctors/${id}/`);
    return mapDoctor(response.data);
  },

  async getAvailability(id: string | number, date: string): Promise<AvailabilitySlot[]> {
    const response = await api.get(`/doctors/${id}/availability/`, {
      params: { date },
    });
    // Maps snake_case variables returned by serializers.py
    return response.data.map((slot: any) => ({
      id: slot.id,
      date: slot.date,
      startTime: slot.start_time,
      endTime: slot.end_time,
      isBooked: slot.is_booked,
      formattedTime: slot.formatted_time,
    }));
  },

  async bookAppointment(
    id: string | number,
    slotId: number | null,
    date: string,
    timeSlot: string,
    reason: string
  ): Promise<Appointment> {
    // Matches AppointmenSerializer keys
    const response = await api.post(`/doctors/${id}/appointments/`, {
      slot: slotId,
      date,
      time_slot: timeSlot,
      reason,
    });
    return mapAppt(response.data);
  },

  async getAppointments(): Promise<Appointment[]> {
    const response = await api.get("/doctors/appointments/");
    return response.data.map(mapAppt);
  },

  async getMessages(id: string | number): Promise<Message[]> {
    const response = await api.get(`/doctors/${id}/messages/`);
    return response.data.map(mapMessage);
  },

  async sendMessage(id: string | number, content: string): Promise<Message> {
    const response = await api.post(`/doctors/${id}/messages/`, {
      content,
    });
    return mapMessage(response.data);
  },
};
