import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, MapPin } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PageTransition } from "@/components/common/PageTransition";
import { api } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { Navigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { useUIStore } from "@/store/uiStore";

export function DoctorAdminPage() {
    const { user } = useAuthStore();
    const [doctors, setDoctors] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useUIStore();

    // Form State
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        id: "",
        name: "",
        specialty: "",
        hospital: "",
        address: "",
        phone: "",
        availability_text: "",
        experience: 5,
    });

    if (!user?.isAdmin) {
        return <Navigate to={ROUTES.HOME} replace />;
    }

    useEffect(() => {
        fetchDoctors();
    }, []);

    const fetchDoctors = async () => {
        try {
            setIsLoading(true);
            const res = await api.get("/doctors/");
            setDoctors(res.data);
        } catch (err) {
            console.error(err);
            addToast({ title: "Error", description: "Failed to fetch doctors", type: "error" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isEditing && formData.id) {
                await api.put(`/doctors/${formData.id}/`, formData);
                addToast({ title: "Success", description: "Doctor updated successfully!", type: "success" });
            } else {
                await api.post("/doctors/", formData);
                addToast({ title: "Success", description: "Doctor created successfully!", type: "success" });
            }
            setIsEditing(false);
            setFormData({
                id: "", name: "", specialty: "", hospital: "", address: "", phone: "", availability_text: "", experience: 5
            });
            fetchDoctors();
        } catch (err: any) {
            if (err.response?.data?.address) {
                addToast({ title: "Geocoding Error", description: err.response.data.address[0], type: "error" });
            } else {
                addToast({ title: "Error", description: "Failed to save doctor details.", type: "error" });
            }
        }
    };

    const editDoctor = (doc: any) => {
        setIsEditing(true);
        setFormData({
            id: doc.id,
            name: doc.name,
            specialty: doc.specialty,
            hospital: doc.hospital,
            address: doc.address || "",
            phone: doc.phone || "",
            availability_text: doc.availability_text || "",
            experience: doc.experience || 5,
        });
    };

    const deleteDoctor = async (id: number) => {
        if (!window.confirm("Are you sure you want to delete this doctor?")) return;
        try {
            await api.delete(`/doctors/${id}/`);
            addToast({ title: "Success", description: "Doctor deleted.", type: "success" });
            fetchDoctors();
        } catch (err) {
            addToast({ title: "Error", description: "Failed to delete doctor.", type: "error" });
        }
    };

    return (
        <PageTransition variant="fade" className="flex flex-col min-h-screen pb-20 md:pb-6">
            <Header title="Doctor Management (Admin)" />
            <div className="p-4 sm:p-6 space-y-6">

                <Card>
                    <CardContent className="p-4">
                        <h3 className="text-lg font-bold mb-4">{isEditing ? "Edit Doctor" : "Add New Doctor"}</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input placeholder="Full Name" name="name" value={formData.name} onChange={handleInputChange} required />
                            <Input placeholder="Specialization" name="specialty" value={formData.specialty} onChange={handleInputChange} required />
                            <Input placeholder="Hospital Name" name="hospital" value={formData.hospital} onChange={handleInputChange} required />
                            <Input placeholder="Address (Physical location)" name="address" value={formData.address} onChange={handleInputChange} required />
                            <Input placeholder="Phone Number" name="phone" value={formData.phone} onChange={handleInputChange} required />
                            <Input placeholder="Availability (e.g., Mon-Fri 9AM-5PM)" name="availability_text" value={formData.availability_text} onChange={handleInputChange} />

                            <div className="flex gap-2">
                                <Button type="submit" className="flex-1">
                                    {isEditing ? "Update Doctor" : "Add Doctor"}
                                </Button>
                                {isEditing && (
                                    <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                                        Cancel
                                    </Button>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <div className="space-y-4 text-white">
                    <h3 className="text-lg font-bold text-foreground">Registered Doctors</h3>
                    {isLoading ? <p>Loading...</p> : doctors.map((doc) => (
                        <Card key={doc.id} className="overflow-hidden">
                            <CardContent className="p-4 flex flex-col gap-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold">{doc.name}</p>
                                        <p className="text-sm text-muted-foreground">{doc.specialty} @ {doc.hospital}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => editDoctor(doc)} className="p-2 text-primary hover:bg-primary/10 rounded-full"><Edit2 size={16} /></button>
                                        <button onClick={() => deleteDoctor(doc.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded-full"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                                <div className="flex items-center text-xs text-muted-foreground gap-1">
                                    <MapPin size={12} /> {doc.address}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

            </div>
        </PageTransition>
    );
}
